"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Panel,
  MiniMap,
  useReactFlow,
  type Connection,
  type NodeTypes,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
  type OnInit,
} from "reactflow";
import "reactflow/dist/style.css";
import { Sidebar } from "@/components/sidebar";
import { PropertiesPanel } from "@/components/properties-panel/properties-panel";
import { IfcNode } from "@/components/nodes/ifc-node";
import { GeometryNode } from "@/components/nodes/geometry-node";
import { FilterNode } from "@/components/nodes/filter-node";
import { TransformNode } from "@/components/nodes/transform-node";
import { ViewerNode } from "@/components/nodes/viewer-node";
import { AppMenubar } from "@/components/menubar";
import { QuantityNode } from "@/components/nodes/quantity-node";
import { PropertyNode } from "@/components/nodes/property-node";
import { ClassificationNode } from "@/components/nodes/classification-node";
import { SpatialNode } from "@/components/nodes/spatial-node";
import { ExportNode } from "@/components/nodes/export-node";
import { RelationshipNode } from "@/components/nodes/relationship-node";
import { AnalysisNode } from "@/components/nodes/analysis-node";
import { WatchNode } from "@/components/nodes/watch-node";
import { ParameterNode } from "@/components/nodes/parameter-node";
import { Toaster } from "@/components/toaster";
import { WorkflowExecutor } from "@/lib/workflow-executor";
import { loadIfcFile, getIfcFile } from "@/lib/ifc-utils";
import { useToast } from "@/hooks/use-toast";
import { FileUp } from "lucide-react";
import type { Workflow } from "@/lib/workflow-storage";
import { useHotkeys } from "react-hotkeys-hook";
import {
  parseKeyCombination,
  useKeyboardShortcuts,
} from "@/lib/keyboard-shortcuts";
import { useAppSettings } from "@/lib/settings-manager";
import { useTheme } from "next-themes";
import { nodeCategories } from "@/components/sidebar";

// Define custom node types
const nodeTypes: NodeTypes = {
  ifcNode: IfcNode,
  geometryNode: GeometryNode,
  filterNode: FilterNode,
  transformNode: TransformNode,
  viewerNode: ViewerNode,
  quantityNode: QuantityNode,
  propertyNode: PropertyNode,
  classificationNode: ClassificationNode,
  spatialNode: SpatialNode,
  exportNode: ExportNode,
  relationshipNode: RelationshipNode,
  analysisNode: AnalysisNode,
  watchNode: WatchNode,
  parameterNode: ParameterNode,
};

// Custom node style to highlight selected nodes
const nodeStyle = {
  selected: {
    boxShadow: "0 0 10px 2px rgba(59, 130, 246, 0.6)",
    borderRadius: "6px",
    zIndex: 10,
  },
  default: {},
};

// Define interfaces
interface FlowState {
  nodes: Node[];
  edges: Edge[];
}
interface NodePosition {
  x: number;
  y: number;
}

// Helper function to find node definition by type
const findNodeDefinition = (nodeType: string) => {
  for (const category of nodeCategories) {
    const nodeDef = category.nodes.find(
      (node: { id: string }) => node.id === nodeType
    );
    if (nodeDef) {
      return nodeDef;
    }
  }
  return null;
};

// Create a wrapper component that uses the ReactFlow hooks
function FlowWithProvider() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { toast } = useToast();
  const { shortcuts } = useKeyboardShortcuts();
  const { settings } = useAppSettings();
  const { theme, setTheme } = useTheme();

  // View settings
  const [showGrid, setShowGrid] = useState(settings.viewer.showGrid);
  const [showMinimap, setShowMinimap] = useState(false);

  // Current workflow state
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);

  // Workflow execution state
  const [isRunning, setIsRunning] = useState(false);
  const [executionResults, setExecutionResults] = useState(new Map());

  // Undo/redo state
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>(
    []
  );
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Node movement tracking
  const [nodeMovementStart, setNodeMovementStart] = useState<
    Record<string, NodePosition | undefined>
  >({});
  const [isNodeDragging, setIsNodeDragging] = useState(false);

  // File drop state
  const [isFileDragging, setIsFileDragging] = useState(false);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get the ReactFlow utility functions
  const reactFlowUtils = useReactFlow();

  // Reference to worker for IFC operations
  const ifcWorkerRef = useRef<Worker | null>(null);

  // Apply theme from settings
  useEffect(() => {
    if (settings.general.theme !== "system") {
      setTheme(settings.general.theme);
    }
  }, [settings.general.theme, setTheme]);

  // Apply grid setting from settings
  useEffect(() => {
    setShowGrid(settings.viewer.showGrid);
  }, [settings.viewer.showGrid]);

  // Set up auto-save
  useEffect(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Set up new timer if auto-save is enabled
    if (settings.general.autoSave && currentWorkflow) {
      const interval = settings.general.autoSaveInterval * 60 * 1000; // Convert minutes to milliseconds
      autoSaveTimerRef.current = setInterval(() => {
        handleAutoSave();
      }, interval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [
    settings.general.autoSave,
    settings.general.autoSaveInterval,
    currentWorkflow,
  ]);

  // Handle auto-save
  const handleAutoSave = () => {
    if (currentWorkflow && reactFlowInstance) {
      const flowData = reactFlowInstance.toObject
        ? reactFlowInstance.toObject()
        : { nodes, edges };
      const updatedWorkflow: Workflow = {
        ...currentWorkflow,
        flowData,
        updatedAt: new Date().toISOString(),
      };

      // Save to storage
      import("@/lib/workflow-storage").then(({ workflowStorage }) => {
        workflowStorage.saveWorkflow(updatedWorkflow);
        toast({
          title: "Auto-saved",
          description: `Workflow "${currentWorkflow.name}" has been auto-saved`,
        });
      });
    }
  };

  // Custom node changes handler to track only start and end positions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Track the start of node dragging
      changes.forEach((change) => {
        if (change.type === "position" && change.dragging) {
          if (!isNodeDragging) {
            // This is the start of a drag operation
            setIsNodeDragging(true);

            // Store the starting positions of all selected nodes
            const startPositions: Record<string, NodePosition | undefined> = {};
            nodes.forEach((node) => {
              if (node.selected || node.id === change.id) {
                startPositions[node.id] = { ...node.position };
              }
            });

            if (
              Object.keys(startPositions).length > 0 &&
              Object.keys(nodeMovementStart).length === 0
            ) {
              setNodeMovementStart(startPositions);
            }
          }
        } else if (
          change.type === "position" &&
          change.dragging === false &&
          isNodeDragging
        ) {
          // This is the end of a drag operation
          setIsNodeDragging(false);

          // Only add to history if we have start positions and this is a real movement
          if (Object.keys(nodeMovementStart).length > 0) {
            // Add the current state to history
            setHistory((prev) => [
              ...prev.slice(0, historyIndex + 1),
              { nodes, edges },
            ]);
            setHistoryIndex((prev) => prev + 1);

            // Reset the start positions
            setNodeMovementStart({});
          }
        } else if (change.type === "select") {
          // When a node is selected, update the selectedNode state
          if (change.selected) {
            const node = nodes.find((n) => n.id === change.id);
            if (node) {
              setSelectedNode(node);
            }
          } else if (selectedNode && selectedNode.id === change.id) {
            // If the currently selected node is deselected, clear the selection
            setSelectedNode(null);
          }
        }
      });

      // Apply the changes to nodes with custom styling for selected nodes
      const updatedNodes = applyNodeChanges(changes, nodes).map((node) => {
        if (node.selected) {
          return {
            ...node,
            style: { ...node.style, ...nodeStyle.selected },
          };
        } else {
          // Remove selection styling if not selected
          const { boxShadow, border, borderRadius, zIndex, ...restStyle } =
            node.style || {};
          return {
            ...node,
            style: restStyle,
          };
        }
      });

      setNodes(updatedNodes);
    },
    [
      nodes,
      edges,
      isNodeDragging,
      nodeMovementStart,
      historyIndex,
      selectedNode,
    ]
  );

  // Update canUndo and canRedo
  useEffect(() => {
    setCanUndo(historyIndex > 0);
    setCanRedo(historyIndex < history.length - 1);
  }, [historyIndex, history]);

  // Add event listeners for file drag events on the document
  useEffect(() => {
    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault();
      // Check if files are being dragged
      if (e.dataTransfer?.types.includes("Files")) {
        setIsFileDragging(true);
      }
    };

    const handleDocumentDragLeave = (e: DragEvent) => {
      // Only consider it a leave if we're leaving the document
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsFileDragging(false);
      }
    };

    const handleDocumentDrop = () => {
      setIsFileDragging(false);
    };

    document.addEventListener(
      "dragover",
      handleDocumentDragOver as EventListener
    );
    document.addEventListener(
      "dragleave",
      handleDocumentDragLeave as EventListener
    );
    document.addEventListener("drop", handleDocumentDrop);

    return () => {
      document.removeEventListener(
        "dragover",
        handleDocumentDragOver as EventListener
      );
      document.removeEventListener(
        "dragleave",
        handleDocumentDragLeave as EventListener
      );
      document.removeEventListener("drop", handleDocumentDrop);
    };
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const { nodes: prevNodes, edges: prevEdges } = history[newIndex];

      // Apply selection styling to nodes
      const styledNodes = prevNodes.map((node) => {
        if (node.selected) {
          return {
            ...node,
            style: { ...node.style, ...nodeStyle.selected },
          };
        }
        return node;
      });

      setNodes(styledNodes);
      setEdges(prevEdges);
      setHistoryIndex(newIndex);

      // Update selected node
      const selectedNodes = styledNodes.filter((node: Node) => node.selected);
      if (selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0]);
      } else {
        setSelectedNode(null);
      }
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const { nodes: nextNodes, edges: nextEdges } = history[newIndex];

      // Apply selection styling to nodes
      const styledNodes = nextNodes.map((node) => {
        if (node.selected) {
          return {
            ...node,
            style: { ...node.style, ...nodeStyle.selected },
          };
        }
        return node;
      });

      setNodes(styledNodes);
      setEdges(nextEdges);
      setHistoryIndex(newIndex);

      // Update selected node
      const selectedNodes = styledNodes.filter((node: Node) => node.selected);
      if (selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0]);
      } else {
        setSelectedNode(null);
      }
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Handle connections between nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(connection, eds);

        // Add to history
        setHistory((prev) => [
          ...prev.slice(0, historyIndex + 1),
          { nodes, edges: newEdges },
        ]);
        setHistoryIndex((prev) => prev + 1);

        return newEdges;
      });
    },
    [nodes, edges, historyIndex, setEdges]
  );

  // Handle node selection for properties panel
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // If we're already in edit mode, single click opens the new node for editing
      if (editingNode) {
        setEditingNode(node);
      } else {
        // If not in edit mode, just select the node
        setEditingNode(null);
      }
    },
    [editingNode]
  );

  // Handle node double-click to open properties panel
  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Only open edit mode on double click if we're not already editing
      if (!editingNode) {
        setEditingNode(node);
      }
    },
    [editingNode]
  );

  // Handle dropping new nodes from the sidebar
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    // Handle different drag types
    if (event.dataTransfer.types.includes("application/reactflow")) {
      event.dataTransfer.dropEffect = "move";
    } else if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Handle dropping files or nodes on the canvas
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsFileDragging(false);

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds || !reactFlowInstance) return;

      // Get the position where the item was dropped
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Check if a node is being dropped from the sidebar
      const nodeType = event.dataTransfer.getData("application/reactflow");
      if (nodeType && nodeType !== "") {
        // Find node definition to get status and label
        const nodeDef = findNodeDefinition(nodeType);
        const label = nodeDef ? nodeDef.label : nodeType.replace("Node", "");
        const status = nodeDef ? nodeDef.status : "working";

        // Create a new node
        const newNode = {
          id: `${nodeType}-${Date.now()}`,
          type: nodeType,
          position,
          data: { label, properties: {}, status },
        } as Node;

        setNodes((nds) => {
          // Deselect all nodes
          const deselectedNodes = nds.map((n) => ({
            ...n,
            selected: false,
            style: { ...n.style },
          }));

          // Add the new node (selected)
          const newNodes = [
            ...deselectedNodes,
            {
              ...newNode,
              selected: true,
              style: nodeStyle.selected,
            },
          ];

          // Set the new node as selected
          setSelectedNode(newNode);

          // Add to history
          setHistory((prev) => [
            ...prev.slice(0, historyIndex + 1),
            { nodes: newNodes, edges },
          ]);
          setHistoryIndex((prev) => prev + 1);

          return newNodes;
        });
        return;
      }

      // Check if files are being dropped
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];

        // Check if it's an IFC file
        if (file.name.toLowerCase().endsWith(".ifc")) {
          handleCreateIfcNode(file, position);
        } else {
          toast({
            title: "Invalid file type",
            description: "Only IFC files are supported",
            variant: "destructive",
          });
        }
      }
    },
    [reactFlowInstance, setNodes, edges, historyIndex, toast]
  );

  // Create a new IFC node with the dropped file
  const handleCreateIfcNode = async (file: File, position: NodePosition) => {
    try {
      // Create a new IFC node
      const newNodeId = `ifcNode-${Date.now()}`;
      const nodeDef = findNodeDefinition("ifcNode");
      const status = nodeDef ? nodeDef.status : "working";

      // Add the node first with a loading state
      setNodes((nds) => {
        // Deselect all nodes
        const deselectedNodes = nds.map((n) => ({
          ...n,
          selected: false,
          style: { ...n.style },
        }));

        // Add the new node (selected)
        const newNode = {
          id: newNodeId,
          type: "ifcNode",
          position,
          data: {
            label: file.name,
            properties: { file: file.name },
            isLoading: true,
            status,
          },
          selected: true,
          style: nodeStyle.selected,
        } as Node;

        const newNodes = [...deselectedNodes, newNode];

        // Set the new node as selected
        setSelectedNode(newNode);

        // Add to history
        setHistory((prev) => [
          ...prev.slice(0, historyIndex + 1),
          { nodes: newNodes, edges },
        ]);
        setHistoryIndex((prev) => prev + 1);

        return newNodes;
      });

      // Load the IFC file
      const model = await loadIfcFile(file);

      // Update the node with the loaded model
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === newNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                model,
                isLoading: false,
              },
              selected: true,
              style: nodeStyle.selected,
            };
          }
          return node;
        });

        // Add to history
        setHistory((prev) => [
          ...prev.slice(0, historyIndex + 1),
          { nodes: updatedNodes, edges },
        ]);
        setHistoryIndex((prev) => prev + 1);

        return updatedNodes;
      });

      toast({
        title: "IFC file loaded",
        description: `Successfully loaded ${file.name}`,
      });
    } catch (error: unknown) {
      console.error("Error loading IFC file:", error);
      toast({
        title: "Error loading IFC file",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  // Handle opening an IFC file
  const handleOpenFile = async (file: File) => {
    try {
      const model = await loadIfcFile(file);
      const nodeDef = findNodeDefinition("ifcNode");
      const status = nodeDef ? nodeDef.status : "working";

      // Create a new IFC node with the loaded model
      const ifcNode = {
        id: `ifcNode-${Date.now()}`,
        type: "ifcNode",
        position: { x: 100, y: 100 },
        data: {
          label: file.name,
          properties: { file: file.name },
          model,
          status,
        },
        selected: true,
        style: nodeStyle.selected,
      } as Node;

      setNodes((nds) => {
        // Deselect all nodes
        const deselectedNodes = nds.map((n) => ({
          ...n,
          selected: false,
          style: { ...n.style },
        }));

        const newNodes = [...deselectedNodes, ifcNode];

        // Set the new node as selected
        setSelectedNode(ifcNode);

        // Add to history
        setHistory((prev) => [
          ...prev.slice(0, historyIndex + 1),
          { nodes: newNodes, edges },
        ]);
        setHistoryIndex((prev) => prev + 1);

        return newNodes;
      });
    } catch (error: unknown) {
      console.error("Error loading IFC file:", error);
      toast({
        title: "Error loading IFC file",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  // Handle saving a workflow
  const handleSaveWorkflow = (filename: string, flowData: any) => {
    // In a real app, this would save to a file or database
    const json = JSON.stringify(flowData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle loading a workflow from the library
  const handleLoadWorkflow = (workflow: Workflow) => {
    if (workflow && workflow.flowData) {
      // Clear current state
      setNodes([]);
      setEdges([]);

      // Set the current workflow
      setCurrentWorkflow(workflow);

      // Load the workflow data
      if (reactFlowInstance) {
        // Small delay to ensure the canvas is clear
        setTimeout(() => {
          const { nodes: flowNodes, edges: flowEdges } = workflow.flowData;

          // Apply selection styling to nodes
          const styledNodes = (flowNodes || []).map((node: Node) => {
            if (node.selected) {
              return {
                ...node,
                style: { ...node.style, ...nodeStyle.selected },
              };
            }
            return node;
          });

          // Load nodes and edges
          setNodes(styledNodes);
          setEdges(flowEdges || []);

          // Reset history
          setHistory([{ nodes: styledNodes, edges: flowEdges || [] }]);
          setHistoryIndex(0);

          // Update selected node
          const selectedNodes = styledNodes.filter(
            (node: Node) => node.selected
          );
          if (selectedNodes.length === 1) {
            setSelectedNode(selectedNodes[0]);
          } else {
            setSelectedNode(null);
          }

          // Don't automatically fit view - user can manually fit if needed
          // reactFlowInstance.fitView()
        }, 50);
      }
    }
  };

  // Handle running a workflow
  const handleRunWorkflow = async () => {
    try {
      setIsRunning(true);
      const executor = new WorkflowExecutor(nodes, edges);
      const results = await executor.execute();
      setExecutionResults(results);

      // Update node data with results
      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (results.has(node.id)) {
            return {
              ...node,
              data: {
                ...node.data,
                result: results.get(node.id),
              },
            };
          }
          return node;
        });

        return updatedNodes;
      });

      setIsRunning(false);

      // Show success message
      toast({
        title: "Workflow executed",
        description: "Workflow completed successfully",
      });
    } catch (error: unknown) {
      console.error("Error executing workflow:", error);
      setIsRunning(false);

      // Create a more detailed error message
      const errorDetails =
        error instanceof Error && error.stack
          ? `${error.message}\n\nStack: ${error.stack}`
          : error instanceof Error
          ? error.message
          : String(error);

      toast({
        title: "Error executing workflow",
        description: errorDetails,
        variant: "destructive",
      });
    }
  };

  // Handle exporting results
  const handleExportResults = (format: string, filename: string) => {
    // Find export nodes and their results
    const exportNodes = nodes.filter((node) => node.type === "exportNode");

    if (exportNodes.length === 0) {
      console.warn("No export nodes found in workflow");
      toast({
        title: "Export failed",
        description: "No export nodes found in workflow",
        variant: "destructive",
      });
      return;
    }

    // Export data from the first export node
    const node = exportNodes[0];
    const nodeId = node.id;

    if (!executionResults.has(nodeId)) {
      console.warn("No results found for export node");
      toast({
        title: "Export failed",
        description:
          "No results found for export node. Run the workflow first.",
        variant: "destructive",
      });
      return;
    }

    const result = executionResults.get(nodeId);

    // In a real app, this would create a file based on the format
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to get the flow object for saving
  const getFlowObject = () => {
    if (reactFlowInstance) {
      return reactFlowInstance.toObject
        ? reactFlowInstance.toObject()
        : { nodes, edges };
    }
    return { nodes, edges };
  };

  // Handle select all nodes
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => ({
        ...node,
        selected: true,
        style: { ...node.style, ...nodeStyle.selected },
      }));
      return updatedNodes;
    });

    // Clear selected node since multiple are selected
    setSelectedNode(null);

    toast({
      title: "Select All",
      description: `Selected ${nodes.length} nodes`,
    });
  }, [nodes, setNodes, toast]);

  // Handle copy selected nodes
  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
      toast({
        title: "Nothing to copy",
        description: "Select nodes to copy first",
      });
      return;
    }

    // Get all edges between selected nodes
    const nodeIds = selectedNodes.map((node) => node.id);
    const relevantEdges = edges.filter(
      (edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );

    // Store in clipboard
    setClipboard({
      nodes: selectedNodes,
      edges: relevantEdges,
    });

    toast({
      title: "Copied",
      description: `Copied ${selectedNodes.length} nodes to clipboard`,
    });
  }, [nodes, edges, toast]);

  // Handle cut selected nodes
  const handleCut = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
      toast({
        title: "Nothing to cut",
        description: "Select nodes to cut first",
      });
      return;
    }

    // Get all edges between selected nodes
    const nodeIds = selectedNodes.map((node) => node.id);
    const relevantEdges = edges.filter(
      (edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
    );

    // Store in clipboard
    setClipboard({
      nodes: selectedNodes,
      edges: relevantEdges,
    });

    // Remove the nodes and edges
    setNodes((nds) => nds.filter((node) => !nodeIds.includes(node.id)));
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !nodeIds.includes(edge.source) || !nodeIds.includes(edge.target)
      )
    );

    // Clear selected node if it was cut
    if (selectedNode && nodeIds.includes(selectedNode.id)) {
      setSelectedNode(null);
    }

    // Add to history
    const newNodes = nodes.filter((node) => !nodeIds.includes(node.id));
    const newEdges = edges.filter(
      (edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
    );

    setHistory((prev) => [
      ...prev.slice(0, historyIndex + 1),
      { nodes: newNodes, edges: newEdges },
    ]);
    setHistoryIndex((prev) => prev + 1);

    toast({
      title: "Cut",
      description: `Cut ${selectedNodes.length} nodes to clipboard`,
    });
  }, [nodes, edges, selectedNode, historyIndex, toast]);

  // Handle paste nodes
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) {
      toast({
        title: "Nothing to paste",
        description: "Copy or cut nodes first",
      });
      return;
    }

    // Create new IDs for the pasted nodes
    const idMap: Record<string, string> = {};
    const newNodes = clipboard.nodes.map((node) => {
      const newId = `${node.type}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 5)}`;
      idMap[node.id] = newId;

      // Offset position slightly to make it clear it's a copy
      const position = {
        x: node.position.x + 50,
        y: node.position.y + 50,
      };

      return {
        ...node,
        id: newId,
        position,
        selected: true,
        style: { ...node.style, ...nodeStyle.selected },
      };
    });

    // Update edges with new IDs
    const newEdges = clipboard.edges.map((edge) => ({
      ...edge,
      id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      source: idMap[edge.source],
      target: idMap[edge.target],
    }));

    // Deselect all current nodes
    setNodes((nds) => {
      const deselectedNodes = nds.map((n) => ({
        ...n,
        selected: false,
        style: { ...n.style },
      }));

      // Add the new nodes
      const updatedNodes = [...deselectedNodes, ...newNodes];

      // Add to history
      setHistory((prev) => [
        ...prev.slice(0, historyIndex + 1),
        { nodes: updatedNodes, edges: [...edges, ...newEdges] },
      ]);
      setHistoryIndex((prev) => prev + 1);

      return updatedNodes;
    });

    // Add the new edges
    setEdges((eds) => [...eds, ...newEdges]);

    toast({
      title: "Pasted",
      description: `Pasted ${newNodes.length} nodes from clipboard`,
    });
  }, [clipboard, nodes, edges, historyIndex, toast]);

  // Handle delete selected nodes
  const handleDelete = useCallback(() => {
    // Delete selected nodes
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      const nodeIds = selectedNodes.map((node) => node.id);

      // Remove the nodes
      setNodes((nodes) => nodes.filter((node) => !nodeIds.includes(node.id)));

      // Remove any connected edges
      setEdges((edges) =>
        edges.filter(
          (edge) =>
            !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
        )
      );

      // Clear selected node if it was deleted
      if (selectedNode && nodeIds.includes(selectedNode.id)) {
        setSelectedNode(null);
      }

      // Add to history
      const newNodes = nodes.filter((node) => !nodeIds.includes(node.id));
      const newEdges = edges.filter(
        (edge) =>
          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
      );

      setHistory((prev) => [
        ...prev.slice(0, historyIndex + 1),
        { nodes: newNodes, edges: newEdges },
      ]);
      setHistoryIndex((prev) => prev + 1);

      toast({
        title: "Nodes deleted",
        description: `Deleted ${selectedNodes.length} node${
          selectedNodes.length > 1 ? "s" : ""
        }`,
      });
    }
  }, [nodes, edges, selectedNode, historyIndex, toast]);

  // Define keyboard shortcut handlers
  const openFileHotkey = () => {
    const openFileDialogTrigger = document.querySelector(
      "[data-open-file-dialog-trigger]"
    ) as HTMLElement;
    if (openFileDialogTrigger) openFileDialogTrigger.click();
  };

  const saveWorkflowHotkey = () => {
    const saveWorkflowDialogTrigger = document.querySelector(
      "[data-save-workflow-dialog-trigger]"
    ) as HTMLElement;
    if (saveWorkflowDialogTrigger) saveWorkflowDialogTrigger.click();
  };

  const saveLocallyHotkey = () => {
    const saveLocallyTrigger = document.querySelector(
      "[data-save-locally-trigger]"
    ) as HTMLElement;
    if (saveLocallyTrigger) saveLocallyTrigger.click();
  };

  const openWorkflowLibraryHotkey = () => {
    const workflowLibraryTrigger = document.querySelector(
      "[data-workflow-library-trigger]"
    ) as HTMLElement;
    if (workflowLibraryTrigger) workflowLibraryTrigger.click();
  };

  const zoomInHotkey = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom ? reactFlowInstance.getZoom() : 1;
      if (reactFlowInstance.zoomTo)
        reactFlowInstance.zoomTo(Math.min(zoom + 0.2, 2));
    }
  };

  const zoomOutHotkey = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom ? reactFlowInstance.getZoom() : 1;
      if (reactFlowInstance.zoomTo)
        reactFlowInstance.zoomTo(Math.max(zoom - 0.2, 0.2));
    }
  };

  const fitViewHotkey = () => {
    if (reactFlowInstance) {
      if (reactFlowInstance.fitView) reactFlowInstance.fitView();
    }
  };

  const toggleGridHotkey = () => setShowGrid(!showGrid);

  const toggleMinimapHotkey = () => setShowMinimap(!showMinimap);

  const helpHotkey = () => {
    const helpDialogTrigger = document.querySelector(
      "[data-help-dialog-trigger]"
    ) as HTMLElement;
    if (helpDialogTrigger) helpDialogTrigger.click();
  };

  const keyboardShortcutsHotkey = () => {
    const helpDialogTrigger = document.querySelector(
      "[data-help-dialog-trigger]"
    ) as HTMLElement;
    if (helpDialogTrigger) {
      helpDialogTrigger.click();
      // Set active tab to shortcuts
      setTimeout(() => {
        const shortcutsTab = document.querySelector(
          '[data-tab="shortcuts"]'
        ) as HTMLElement;
        if (shortcutsTab) shortcutsTab.click();
      }, 100);
    }
  };

  // Register all keyboard shortcuts at the top level
  // Open File
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "open-file")?.keys || "ctrl+o"
    ),
    openFileHotkey,
    {
      preventDefault: true,
    }
  );

  // Save Workflow
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "save-workflow")?.keys || "ctrl+s"
    ),
    saveWorkflowHotkey,
    { preventDefault: true }
  );

  // Save Workflow Locally
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "save-workflow-locally")?.keys ||
        "ctrl+shift+s"
    ),
    saveLocallyHotkey,
    { preventDefault: true }
  );

  // Open Workflow Library
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "open-workflow-library")?.keys || "ctrl+l"
    ),
    openWorkflowLibraryHotkey,
    { preventDefault: true }
  );

  // Undo
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "undo")?.keys || "ctrl+z"
    ),
    handleUndo,
    {
      preventDefault: true,
      enabled: canUndo,
    }
  );

  // Redo
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "redo")?.keys || "ctrl+shift+z"
    ),
    handleRedo,
    {
      preventDefault: true,
      enabled: canRedo,
    }
  );

  // Select All
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "select-all")?.keys || "ctrl+a"
    ),
    handleSelectAll,
    {
      preventDefault: true,
    }
  );

  // Cut
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "cut")?.keys || "ctrl+x"
    ),
    handleCut,
    {
      preventDefault: true,
    }
  );

  // Copy
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "copy")?.keys || "ctrl+c"
    ),
    handleCopy,
    {
      preventDefault: true,
    }
  );

  // Paste
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "paste")?.keys || "ctrl+v"
    ),
    handlePaste,
    {
      preventDefault: true,
    }
  );

  // Delete
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "delete")?.keys || "delete"
    ),
    handleDelete,
    {
      preventDefault: true,
    }
  );

  // Run Workflow
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "run-workflow")?.keys || "f5"
    ),
    handleRunWorkflow,
    {
      preventDefault: true,
    }
  );

  // Zoom In
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "zoom-in")?.keys || "ctrl+="
    ),
    zoomInHotkey,
    {
      preventDefault: true,
    }
  );

  // Zoom Out
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "zoom-out")?.keys || "ctrl+-"
    ),
    zoomOutHotkey,
    {
      preventDefault: true,
    }
  );

  // Fit View
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "fit-view")?.keys || "ctrl+0"
    ),
    fitViewHotkey,
    {
      preventDefault: true,
    }
  );

  // Toggle Grid
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "toggle-grid")?.keys || "ctrl+g"
    ),
    toggleGridHotkey,
    {
      preventDefault: true,
    }
  );

  // Toggle Minimap
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "toggle-minimap")?.keys || "ctrl+m"
    ),
    toggleMinimapHotkey,
    { preventDefault: true }
  );

  // Help
  useHotkeys(
    parseKeyCombination(shortcuts.find((s) => s.id === "help")?.keys || "f1"),
    helpHotkey,
    {
      preventDefault: true,
    }
  );

  // Keyboard Shortcuts
  useHotkeys(
    parseKeyCombination(
      shortcuts.find((s) => s.id === "keyboard-shortcuts")?.keys || "shift+f1"
    ),
    keyboardShortcutsHotkey,
    { preventDefault: true }
  );

  // Add event handler for IFC export events
  useEffect(() => {
    const handleIfcExport = async (event: CustomEvent) => {
      const { model, exportFileName, originalFileName } = event.detail;

      console.log("IFC export event received:", {
        exportFileName: exportFileName,
        originalFileName: originalFileName,
        modelElementCount: model.elements?.length || 0,
      });

      console.log("Export event model object:", JSON.stringify(model));

      // Retrieve the original File object using the original filename
      const originalFile = getIfcFile(originalFileName);

      if (!originalFile) {
        console.error(
          `Could not find cached File object for ${originalFileName}`
        );
        toast({
          title: "Export Failed",
          description: `Original file data for ${originalFileName} not found. Please reload the file.`,
          variant: "destructive",
        });
        return; // Stop if file object is missing
      }

      // Read the file into a *NEW* ArrayBuffer just before sending
      let bufferForExport: ArrayBuffer;
      try {
        bufferForExport = await originalFile.arrayBuffer();
        console.log(
          `Read fresh ArrayBuffer for export: ${originalFileName}, size: ${bufferForExport.byteLength}`
        );
      } catch (readError) {
        console.error(
          `Error reading file ${originalFileName} into ArrayBuffer:`,
          readError
        );
        toast({
          title: "Export Failed",
          description: `Could not read data for ${originalFileName}.`,
          variant: "destructive",
        });
        return;
      }

      // Make sure we have a worker initialized
      if (!ifcWorkerRef.current) {
        console.log("Initializing worker for export");
        const worker = new Worker(
          new URL("../public/ifcWorker.js", import.meta.url)
        );

        worker.onmessage = (e) => {
          const { type, data, fileName, message } = e.data;

          switch (type) {
            case "progress":
              console.log(
                `Export progress: ${message} (${e.data.percentage}%)`
              );
              break;

            case "ifcExported":
              console.log("IFC export complete, creating download");
              if (data) {
                // Create a download URL
                const url = URL.createObjectURL(data);

                // Create a temporary download link
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();

                // Clean up
                setTimeout(() => {
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }, 100);

                toast({
                  title: "Export Complete",
                  description: `IFC file "${fileName}" has been exported and downloaded.`,
                });
              }
              break;

            case "error":
              console.error("IFC export error:", message);
              toast({
                title: "Export Failed",
                description: message,
                variant: "destructive",
              });
              break;
          }
        };

        ifcWorkerRef.current = worker;
      }

      // Send export request to worker, transferring the NEW ArrayBuffer
      ifcWorkerRef.current.postMessage(
        {
          action: "exportIfc",
          data: {
            model, // Model data (with modifications)
            fileName: exportFileName, // Use the correct variable for the desired output filename
            arrayBuffer: bufferForExport, // <-- Send the NEW buffer
          },
          messageId: Date.now().toString(),
        },
        [bufferForExport] // Transfer the NEW buffer to the worker
      );
    };

    // Create a non-async wrapper for the event listener
    const eventListenerWrapper = (event: Event) => {
      // Type assertion needed because we know it's a CustomEvent from our dispatch
      handleIfcExport(event as CustomEvent).catch((error: any) => {
        console.error("Error handling IFC export event:", error);
        // Optionally show a generic error toast here
      });
    };

    // Add event listener for export requests using the wrapper
    window.addEventListener("ifc:export", eventListenerWrapper);

    return () => {
      window.removeEventListener("ifc:export", eventListenerWrapper);
    };
  }, [toast]);

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        onLoadWorkflow={handleLoadWorkflow}
        getFlowObject={getFlowObject}
      />
      <div className="flex flex-col flex-1">
        <AppMenubar
          onOpenFile={handleOpenFile}
          onSaveWorkflow={(wf: Workflow) =>
            handleSaveWorkflow(wf.name, wf.flowData)
          }
          onRunWorkflow={handleRunWorkflow}
          onLoadWorkflow={handleLoadWorkflow}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          getFlowObject={getFlowObject}
          currentWorkflow={currentWorkflow}
          reactFlowInstance={reactFlowInstance}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showMinimap={showMinimap}
          setShowMinimap={setShowMinimap}
          onSelectAll={handleSelectAll}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onDelete={handleDelete}
        />
        <div className={`flex-1 h-full relative`} ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance as OnInit<any, any>}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={() => setEditingNode(null)}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[15, 15]}
            minZoom={0.1}
            maxZoom={2}
          >
            <Controls />
            {showGrid && <Background color="#aaa" gap={16} />}
            {showMinimap && <MiniMap />}
            <Panel position="bottom-right">
              <div className="bg-card rounded-md p-2 text-xs text-muted-foreground">
                {currentWorkflow ? currentWorkflow.name : "IFCflow - v0.1.0"}
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>
      {editingNode && (
        <PropertiesPanel
          node={editingNode}
          setNodes={setNodes}
          setSelectedNode={setEditingNode}
        />
      )}
      <Toaster />
    </div>
  );
}

// Main component that wraps everything with ReactFlowProvider
export default function Home() {
  return (
    <ReactFlowProvider>
      <FlowWithProvider />
    </ReactFlowProvider>
  );
}

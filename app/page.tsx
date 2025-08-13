"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  type SelectionMode,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { QuantityNode } from "@/components/nodes/quantity-node";
import { PropertyNode } from "@/components/nodes/property-node";
import { ClassificationNode } from "@/components/nodes/classification-node";
import { SpatialNode } from "@/components/nodes/spatial-node";
import { ExportNode } from "@/components/nodes/export-node";
import { RelationshipNode } from "@/components/nodes/relationship-node";
import { AnalysisNode } from "@/components/nodes/analysis-node";
import { WatchNode } from "@/components/nodes/watch-node";
import { ParameterNode } from "@/components/nodes/parameter-node";
import { PythonNode } from "@/components/nodes/python-node";
import { Toaster } from "@/components/toaster";
import { WorkflowExecutor } from "@/lib/workflow-executor";
import { loadIfcFile, getIfcFile, downloadExportedFile } from "@/lib/ifc-utils";
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
import { ViewerFocusProvider } from "@/components/contexts/viewer-focus-context";
import { nodeCategories } from "@/components/sidebar";

// Import the centralized nodeTypes to prevent React Flow warning
import { nodeTypes } from "@/components/nodes";

// Define all ReactFlow props outside the component to prevent warnings
const edgeTypes = {};
const snapGrid: [number, number] = [15, 15];
const proOptions = { hideAttribution: true };
const defaultStyle = { cursor: 'default' };
const placementStyle = { cursor: 'crosshair' };

// Define interfaces
interface FlowState {
  nodes: Node[];
  edges: Edge[];
}

interface NodePosition {
  x: number;
  y: number;
}

const generateId = () => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to load viewer settings from localStorage synchronously
const loadViewerSetting = (key: 'showGrid' | 'showMinimap', defaultValue: boolean): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.viewer?.[key] ?? defaultValue;
      }
    } catch (e) {
      console.error(`Error loading ${key} setting:`, e);
    }
  }
  return defaultValue;
};

// Removed getViewportClass to prevent hydration mismatch
// Using isMobile hook instead which properly handles SSR

// Create a wrapper component that uses the ReactFlow hooks
function FlowWithProvider() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { shortcuts } = useKeyboardShortcuts();
  const { settings, updateViewerSettings } = useAppSettings();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  // nodeTypes and edgeTypes are now defined outside the component
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // View settings - start with defaults to match server rendering
  const [showGrid, setShowGridState] = useState(true);
  const [showMinimap, setShowMinimapState] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // Wrapper functions to update both state and localStorage
  const setShowGrid = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(showGrid) : value;
    setShowGridState(newValue);
    updateViewerSettings({ showGrid: newValue });
  }, [showGrid, updateViewerSettings]);

  const setShowMinimap = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(showMinimap) : value;
    setShowMinimapState(newValue);
    updateViewerSettings({ showMinimap: newValue });
  }, [showMinimap, updateViewerSettings]);

  // Load persisted settings after mount to avoid hydration issues
  useEffect(() => {
    // Load settings from localStorage after component mounts
    const gridSetting = loadViewerSetting('showGrid', true);
    const minimapSetting = loadViewerSetting('showMinimap', false);

    setShowGridState(gridSetting);
    setShowMinimapState(minimapSetting);
    setIsSettingsLoaded(true);
  }, []); // Only run once on mount



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



  // Focused viewer state
  const [focusedViewerId, setFocusedViewerId] = useState<string | null>(null);

  // Mobile placement mode state
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);

  // Get the ReactFlow utility functions
  const reactFlowInstance = useReactFlow();

  // Helper function to find shortcut by ID
  const findShortcut = (id: string) => {
    return shortcuts.find(s => s.id === id)?.keys || "";
  };

  // Handle keyboard shortcuts
  // Save (Ctrl+S)
  useHotkeys(
    findShortcut("save-workflow") || "ctrl+s,cmd+s",
    (e) => {
      e.preventDefault();
      // Save current workflow if exists
      if (currentWorkflow) {
        const flowData = reactFlowInstance.toObject();
        handleSaveWorkflow(currentWorkflow.name, flowData);
      }
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA"] }
  );

  // Open (Ctrl+O)
  useHotkeys(
    findShortcut("open-file") || "ctrl+o,cmd+o",
    (e) => {
      e.preventDefault();
      // Trigger file open dialog
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".ifc";
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          handleOpenFile(file);
        }
      };
      input.click();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA"] }
  );

  // Undo (Ctrl+Z)
  useHotkeys(
    findShortcut("undo") || "ctrl+z,cmd+z",
    (e) => {
      if (!e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    },
    { enableOnFormTags: false }
  );

  // Redo (Ctrl+Shift+Z or Ctrl+Y)
  useHotkeys(
    findShortcut("redo") || "ctrl+shift+z,cmd+shift+z,ctrl+y,cmd+y",
    (e) => {
      e.preventDefault();
      handleRedo();
    },
    { enableOnFormTags: false }
  );

  // Select All (Ctrl+A)
  useHotkeys(
    findShortcut("select-all") || "ctrl+a,cmd+a",
    (e) => {
      e.preventDefault();
      handleSelectAll();
    },
    { enableOnFormTags: false }
  );

  // Copy (Ctrl+C)
  useHotkeys(
    findShortcut("copy") || "ctrl+c,cmd+c",
    (e) => {
      console.log('[DEBUG] Copy hotkey triggered');

      const activeElement = document.activeElement;
      console.log('[DEBUG] Active element:', activeElement?.tagName, activeElement?.className);

      // Check if we're in a form field
      const isInFormField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );
      console.log('[DEBUG] Is in form field:', isInFormField);

      const selectedNodes = nodes.filter((node) => node.selected);
      console.log('[DEBUG] Selected nodes count:', selectedNodes.length);

      // Handle copy if we're not in a form field and have selected nodes
      if (!isInFormField && selectedNodes.length > 0) {
        console.log('[DEBUG] Executing handleCopy');
        e.preventDefault();
        e.stopPropagation();
        handleCopy();
      } else {
        console.log('[DEBUG] Copy not executed - form field:', isInFormField, 'selected:', selectedNodes.length);
      }
    },
    { enableOnFormTags: false }
  );

  // Cut (Ctrl+X)
  useHotkeys(
    findShortcut("cut") || "ctrl+x,cmd+x",
    (e) => {
      console.log('[DEBUG] Cut hotkey triggered');

      const activeElement = document.activeElement;
      const isInFormField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );

      const selectedNodes = nodes.filter((node) => node.selected);
      console.log('[DEBUG] Cut - selected nodes:', selectedNodes.length);

      if (!isInFormField && selectedNodes.length > 0) {
        console.log('[DEBUG] Executing handleCut');
        e.preventDefault();
        e.stopPropagation();
        handleCut();
      }
    },
    { enableOnFormTags: false }
  );

  // Paste (Ctrl+V)
  useHotkeys(
    findShortcut("paste") || "ctrl+v,cmd+v",
    (e) => {
      console.log('[DEBUG] Paste hotkey triggered');
      console.log('[DEBUG] Clipboard:', clipboard);

      const activeElement = document.activeElement;
      const isInFormField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );

      if (!isInFormField && clipboard && clipboard.nodes.length > 0) {
        console.log('[DEBUG] Executing handlePaste');
        e.preventDefault();
        e.stopPropagation();
        handlePaste();
      } else {
        console.log('[DEBUG] Paste not executed - form field:', isInFormField, 'clipboard:', clipboard?.nodes?.length || 0);
      }
    },
    { enableOnFormTags: false }
  );

  // Delete (Delete key)
  useHotkeys(
    "delete,backspace",
    (e) => {
      e.preventDefault();
      handleDelete();
    },
    { enableOnFormTags: false }
  );

  // Run Workflow (F5)
  useHotkeys(
    findShortcut("run-workflow") || "F5",
    (e) => {
      e.preventDefault();
      handleRunWorkflow();
    },
    { enableOnFormTags: false }
  );

  // Function to handle saving to history
  const saveToHistory = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      const newHistoryItem = { nodes, edges };

      // Remove any future history if we're not at the end
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newHistoryItem);

      // Keep history limited to 50 items
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(historyIndex + 1);
      }

      setHistory(newHistory);
      setCanUndo(true);
      setCanRedo(false);
    },
    [history, historyIndex]
  );

  // Handle undo
  const handleUndo = useCallback(() => {
    if (!canUndo || historyIndex <= 0) return;

    const previousState = history[historyIndex - 1];
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    setHistoryIndex(historyIndex - 1);
    setCanUndo(historyIndex - 1 > 0);
    setCanRedo(true);
  }, [canUndo, historyIndex, history, setNodes, setEdges]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (!canRedo || historyIndex >= history.length - 1) return;

    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHistoryIndex(historyIndex + 1);
    setCanRedo(historyIndex + 1 < history.length - 1);
    setCanUndo(true);
  }, [canRedo, historyIndex, history, setNodes, setEdges]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const updatedNodes = nodes.map((node) => ({
      ...node,
      selected: true,
      // Remove style modification - CSS handles this now
    }));
    setNodes(updatedNodes);

    toast({
      title: "Select All",
      description: `Selected ${nodes.length} nodes`,
    });
  }, [nodes, setNodes, toast]);

  // Handle copy
  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    const selectedNodeIds = selectedNodes.map((node) => node.id);
    const selectedEdges = edges.filter(
      (edge) =>
        selectedNodeIds.includes(edge.source) &&
        selectedNodeIds.includes(edge.target)
    );

    setClipboard({ nodes: selectedNodes, edges: selectedEdges });
    toast({
      title: "Copied",
      description: `${selectedNodes.length} node(s) and ${selectedEdges.length} connection(s) copied`,
    });
  }, [nodes, edges, toast]);

  // Handle delete
  const handleDelete = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;

    // Save current state to history before deletion
    saveToHistory(nodes, edges);

    const selectedNodeIds = selectedNodes.map((node) => node.id);

    // Remove selected nodes
    const remainingNodes = nodes.filter((node) => !node.selected);
    // Remove edges connected to deleted nodes
    const remainingEdges = edges.filter(
      (edge) =>
        !selectedNodeIds.includes(edge.source) &&
        !selectedNodeIds.includes(edge.target)
    );

    setNodes(remainingNodes);
    setEdges(remainingEdges);

    toast({
      title: "Deleted",
      description: `${selectedNodes.length} node(s) deleted`,
    });
  }, [nodes, edges, saveToHistory, setNodes, setEdges, toast]);

  // Handle cut
  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Save current state to history before pasting
    saveToHistory(nodes, edges);

    const idMapping = new Map<string, string>();
    const offset = { x: 50, y: 50 }; // Offset for pasted nodes

    // Create new nodes with new IDs and positions
    const newNodes = clipboard.nodes.map((node) => {
      const newId = generateId();
      idMapping.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true, // Select the pasted nodes
        // Remove style modification - CSS handles this now
      };
    });

    // Create new edges with updated node IDs
    const newEdges = clipboard.edges.map((edge) => ({
      ...edge,
      id: `${idMapping.get(edge.source)}-${idMapping.get(edge.target)}`,
      source: idMapping.get(edge.source) || edge.source,
      target: idMapping.get(edge.target) || edge.target,
    }));

    // Deselect existing nodes
    const updatedExistingNodes = nodes.map((node) => ({
      ...node,
      selected: false,
      // Remove style modification - CSS handles this now
    }));

    setNodes([...updatedExistingNodes, ...newNodes]);
    setEdges([...edges, ...newEdges]);

    toast({
      title: "Pasted",
      description: `${newNodes.length} node(s) and ${newEdges.length} connection(s) pasted`,
    });
  }, [clipboard, nodes, edges, saveToHistory, setNodes, setEdges, toast]);

  // Updated node changes handler with history
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes immediately for smooth interaction
      onNodesChange(changes);

      // Check if this is a position change (dragging)
      const isPositionChange = changes.some(
        (change) => change.type === "position"
      );

      // Check if dragging has ended
      const isDragEnd = changes.some(
        (change) =>
          change.type === "position" &&
          change.dragging === false &&
          isNodeDragging
      );

      // Track drag start
      if (isPositionChange && !isNodeDragging) {
        const isDragStart = changes.some(
          (change) => change.type === "position" && change.dragging === true
        );
        if (isDragStart) {
          setIsNodeDragging(true);
        }
      }

      // Save to history only when drag ends
      if (isDragEnd) {
        setIsNodeDragging(false);
        // Use a small delay to ensure final position is captured
        setTimeout(() => {
          saveToHistory(nodes, edges);
        }, 50);
      }

      // For non-drag changes, save to history after a delay
      const isSelectionChange = changes.every(
        (change) => change.type === "select"
      );

      if (!isSelectionChange && !isPositionChange) {
        // Auto-save timer for other changes
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          saveToHistory(nodes, edges);
        }, 1000);
      }
    },
    [nodes, edges, onNodesChange, saveToHistory, isNodeDragging]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      // Save current state to history before connecting
      saveToHistory(nodes, edges);

      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}`,
        type: "default",
        style: { stroke: "#888", strokeWidth: 2 },
        animated: false,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [nodes, edges, saveToHistory, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Helper function to get user-friendly node label
  const getNodeLabel = useCallback((nodeId: string) => {
    for (const category of nodeCategories) {
      const node = category.nodes.find(n => n.id === nodeId);
      if (node) {
        return node.label;
      }
    }
    return nodeId; // fallback to ID if not found
  }, []);



  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      // Check if the dropped element is valid
      if (typeof type === "undefined" || !type) {
        return;
      }

      if (!reactFlowBounds) {
        return;
      }

      // Get the cursor position in flow coordinates
      // Use screenToFlowPosition for consistent coordinate transformation
      const cursorPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Position the node with its top-left corner at the cursor position
      // No offset needed - we want exact cursor positioning
      const position = {
        x: cursorPosition.x,
        y: cursorPosition.y,
      };

      // Save current state to history before adding new node
      saveToHistory(nodes, edges);

      const newNode: Node = {
        id: generateId(),
        type,
        position,
        data: {
          label: getNodeLabel(type),
        },
        // CSS handles node styling now
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodes, edges, saveToHistory, setNodes, getNodeLabel]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
  }, []);

  // Handle file operations
  const handleOpenFile = useCallback(
    async (file: File) => {
      try {
        // Save current state to history before opening new file
        saveToHistory(nodes, edges);

        const result = await loadIfcFile(file);

        const position = { x: 100, y: 100 };
        const newNode: Node = {
          id: generateId(),
          type: "ifcNode",
          position,
          data: {
            fileName: file.name,
            fileSize: file.size,
            fileHandle: result,
            modelState: null,
          },
          // CSS handles node styling now
        };

        setNodes((nds) => [...nds, newNode]);

        toast({
          title: "IFC File Loaded",
          description: `Successfully loaded ${file.name}`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to load IFC file: ${error}`,
          variant: "destructive",
        });
      }
    },
    [nodes, edges, saveToHistory, setNodes, toast]
  );

  const handleSaveWorkflow = useCallback(
    (name: string, flowData: any) => {
      // Implementation for saving workflow
      setCurrentWorkflow({
        id: Date.now().toString(),
        name,
        flowData,
        description: "",
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast({
        title: "Workflow Saved",
        description: `${name} has been saved`,
      });
    },
    [toast]
  );

  const handleLoadWorkflow = useCallback(
    (workflow: Workflow) => {
      // Save current state to history before loading new workflow
      saveToHistory(nodes, edges);

      setNodes(workflow.flowData.nodes || []);
      setEdges(workflow.flowData.edges || []);
      setCurrentWorkflow(workflow);

      toast({
        title: "Workflow Loaded",
        description: `${workflow.name} has been loaded`,
      });
    },
    [nodes, edges, saveToHistory, setNodes, setEdges, toast]
  );

  const handleRunWorkflow = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      // Create a real-time node update callback
      const onNodeUpdate = (nodeId: string, newData: any) => {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  ...newData,
                },
              };
            }
            return node;
          })
        );
      };

      const executor = new WorkflowExecutor(nodes, edges, onNodeUpdate);
      const results = await executor.execute();
      setExecutionResults(results);

      // Get the updated nodes from the executor (includes inputData for watch nodes)
      const updatedNodes = executor.getUpdatedNodes();

      // Update the React Flow nodes with the execution results
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          // Find the corresponding updated node from the executor
          const updatedNode = updatedNodes.find((n: any) => n.id === node.id);
          if (updatedNode && updatedNode.data) {
            // Merge the updated data while preserving React Flow properties
            return {
              ...node,
              data: {
                ...node.data,
                ...updatedNode.data,
              },
            };
          }
          return node;
        })
      );

      toast({
        title: "Workflow Complete",
        description: "Workflow executed successfully",
      });
    } catch (error) {
      toast({
        title: "Execution Error",
        description: `Failed to execute workflow: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, nodes, edges, setNodes, toast]);

  // Helper function to get current flow object
  const getFlowObject = useCallback(() => {
    return reactFlowInstance.toObject();
  }, [reactFlowInstance]);

  // File drag and drop handlers
  const handleFileDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes("Files")) {
      setIsFileDragging(true);
    }
  }, []);

  const handleFileDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    // Only hide if leaving the main container
    if (e.target === reactFlowWrapper.current) {
      setIsFileDragging(false);
    }
  }, []);

  const handleFileDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsFileDragging(false);

      const files = Array.from(e.dataTransfer?.files || []);
      const ifcFiles = files.filter((file) =>
        file.name.toLowerCase().endsWith(".ifc")
      );

      if (ifcFiles.length > 0) {
        for (const file of ifcFiles) {
          await handleOpenFile(file);
        }
      }
    },
    [handleOpenFile]
  );

  // Set up drag and drop listeners
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    wrapper.addEventListener("dragenter", handleFileDragEnter);
    wrapper.addEventListener("dragleave", handleFileDragLeave);
    wrapper.addEventListener("drop", handleFileDrop);

    return () => {
      wrapper.removeEventListener("dragenter", handleFileDragEnter);
      wrapper.removeEventListener("dragleave", handleFileDragLeave);
      wrapper.removeEventListener("drop", handleFileDrop);
    };
  }, [handleFileDragEnter, handleFileDragLeave, handleFileDrop]);

  // Listen for export completion events
  useEffect(() => {
    const handleExportComplete = async (event: CustomEvent) => {
      const { model, exportFileName, originalFileName } = event.detail;

      try {
        // Get the original IFC file buffer
        const originalFile = getIfcFile(originalFileName);
        if (!originalFile) {
          toast({
            title: "Export Error",
            description: "Original IFC file not found. Please reload the file and try again.",
            variant: "destructive",
          });
          return;
        }

        // Convert file to ArrayBuffer if needed
        const arrayBuffer = await originalFile.arrayBuffer();

        // Create a new worker for the export
        const worker = new Worker('/ifcWorker.js');

        // Set up message handler for export result
        worker.onmessage = (e) => {
          if (e.data.type === 'ifcExported') {
            // Download the exported IFC file
            // The worker sends an ArrayBuffer, convert to Blob
            const blob = new Blob([e.data.data], { type: 'application/x-step' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = e.data.fileName || exportFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
              title: "Export Successful",
              description: `IFC file exported as ${e.data.fileName || exportFileName}`,
            });

            worker.terminate();
          } else if (e.data.type === 'error') {
            toast({
              title: "Export Error",
              description: e.data.message || "Failed to export IFC file",
              variant: "destructive",
            });
            worker.terminate();
          }
        };

        // Send export request to worker
        worker.postMessage({
          action: 'exportIfc',
          model: model,
          fileName: exportFileName,
          arrayBuffer: arrayBuffer,
          messageId: Date.now().toString()
        }, [arrayBuffer]);

      } catch (error) {
        console.error("Error exporting IFC:", error);
        toast({
          title: "Export Error",
          description: error instanceof Error ? error.message : "Failed to export IFC file",
          variant: "destructive",
        });
      }
    };

    const eventListenerWrapper = (event: Event) => {
      handleExportComplete(event as CustomEvent);
    };

    window.addEventListener("ifc:export", eventListenerWrapper);

    return () => {
      window.removeEventListener("ifc:export", eventListenerWrapper);
    };
  }, [toast]);

  // Handle sidebar toggle with better mobile UX
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(!sidebarOpen);

    // Add haptic feedback on mobile devices that support it
    if ('vibrate' in navigator && isMobile) {
      navigator.vibrate(50);
    }
  }, [sidebarOpen, isMobile]);

  // Close sidebar when clicking outside on mobile
  const handleBackdropClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isMobile, sidebarOpen]);

  // Handle mobile node selection for placement mode
  const handleMobileNodeSelect = useCallback((nodeType: string) => {
    if (selectedNodeType === nodeType) {
      // Clicking the same node cancels placement mode
      setSelectedNodeType(null);
      setPlacementMode(false);
    } else {
      // Select new node type and enter placement mode
      setSelectedNodeType(nodeType);
      setPlacementMode(true);
    }
  }, [selectedNodeType]);

  // Handle canvas click/tap for node placement
  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (!isMobile || !placementMode || !selectedNodeType) return;

    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!reactFlowBounds) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    // Save current state to history before adding new node
    saveToHistory(nodes, edges);

    const newNode: Node = {
      id: generateId(),
      type: selectedNodeType,
      position,
      data: {
        label: getNodeLabel(selectedNodeType),
      },
      // CSS handles node styling now
    };

    setNodes((nds) => nds.concat(newNode));

    // Exit placement mode after placing node
    setSelectedNodeType(null);
    setPlacementMode(false);

    // Close sidebar on mobile after placement
    if (isMobile) {
      setSidebarOpen(false);
    }

    toast({
      title: "Node added",
      description: `${getNodeLabel(selectedNodeType)} placed successfully`,
    });
  }, [isMobile, placementMode, selectedNodeType, reactFlowInstance, nodes, edges, saveToHistory, setNodes, toast]);

  // Keyboard shortcuts for copy/paste/delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in form fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (cmdOrCtrl) {
        switch (event.key.toLowerCase()) {
          case 'c':
          case 'x':
            event.preventDefault();
            handleCopy();
            break;
          case 'v':
            event.preventDefault();
            handlePaste();
            break;
          case 'a':
            event.preventDefault();
            handleSelectAll();
            break;
        }
      }

      // Handle Delete/Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          handleDelete();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, handleCopy, handlePaste, handleSelectAll, handleDelete]);

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Unified Sidebar - Mobile & Desktop */}
      <div className={`
        ${isMobile
          ? `fixed inset-0 z-50 ${sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`
          : 'relative'
        }
      `}>
        {/* Mobile backdrop */}
        {isMobile && (
          <div
            className={`
              absolute inset-0 bg-black/50 transition-opacity duration-300 ease-in-out
              ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
            onClick={handleBackdropClick}
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar container */}
        <div className={`
          ${isMobile
            ? `absolute left-0 top-0 h-full w-80 transform transition-transform duration-300 ease-in-out
               ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
               shadow-xl`
            : 'relative h-full'
          }
          bg-background border-r z-60
        `}>
          <Sidebar
            onLoadWorkflow={handleLoadWorkflow}
            getFlowObject={getFlowObject}
            isMobile={isMobile}
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
            onNodeSelect={handleMobileNodeSelect}
            selectedNodeType={selectedNodeType}
            placementMode={placementMode}
          />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
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
          onToggleSidebar={handleSidebarToggle}
          sidebarOpen={sidebarOpen}
        />
        <div className={`flex-1 h-full relative`} ref={reactFlowWrapper}>
          {isFileDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="bg-white bg-opacity-80 p-6 rounded-lg shadow-lg border-2 border-dashed border-blue-500">
                <FileUp className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                <p className="text-lg font-medium text-blue-700">
                  Drop IFC file here
                </p>
              </div>
            </div>
          )}

          {/* Mobile placement mode overlay */}
          {isMobile && placementMode && selectedNodeType && (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                <span className="text-sm font-medium">
                  Tap to place {getNodeLabel(selectedNodeType)}
                </span>
              </div>

              {/* Crosshair indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-8 h-0.5 bg-primary/60 absolute left-4 top-1/2 transform -translate-y-1/2" />
                  <div className="w-8 h-0.5 bg-primary/60 absolute -left-4 top-1/2 transform -translate-y-1/2" />
                  <div className="w-0.5 h-8 bg-primary/60 absolute left-1/2 top-4 transform -translate-x-1/2" />
                  <div className="w-0.5 h-8 bg-primary/60 absolute left-1/2 -top-4 transform -translate-x-1/2" />
                  <div className="w-3 h-3 border-2 border-primary bg-primary/20 rounded-full absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          )}

          <ViewerFocusProvider
            focusedViewerId={focusedViewerId}
            setFocusedViewerId={setFocusedViewerId}
          >
            {/* Container for ReactFlow */}
            <div className="flex-1 h-full w-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                autoPanOnConnect={false}
                autoPanOnNodeDrag={false}
                onPaneClick={(event) => {
                  // Handle mobile node placement first
                  if (isMobile && placementMode && selectedNodeType) {
                    handleCanvasClick(event);
                    return;
                  }

                  setEditingNode(null);
                  // Exit 3D focus mode when clicking on canvas
                  if (focusedViewerId) {
                    setFocusedViewerId(null);
                  }

                  // Close sidebar on mobile when clicking canvas (only if not in placement mode)
                  if (isMobile && sidebarOpen && !placementMode) {
                    setSidebarOpen(false);
                  }
                }}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                snapToGrid={isSettingsLoaded ? showGrid : false}
                snapGrid={snapGrid}
                minZoom={0.1}
                maxZoom={2}
                proOptions={proOptions}
                style={isMobile && placementMode ? placementStyle : defaultStyle}
                // Multi-selection configuration
                multiSelectionKeyCode="Meta"
                selectionOnDrag={true}
                selectNodesOnDrag={false}
                selectionMode={"partial" as SelectionMode}
                nodesFocusable={true}
                edgesFocusable={true}
                // Disable interactions when viewer is in focus mode or in placement mode
                panOnDrag={!focusedViewerId && !(isMobile && placementMode)}
                zoomOnScroll={!focusedViewerId && !(isMobile && placementMode)}
                zoomOnPinch={!focusedViewerId && !(isMobile && placementMode)}
                zoomOnDoubleClick={!focusedViewerId && !(isMobile && placementMode)}
                elementsSelectable={!(isMobile && placementMode)}
                nodesConnectable={!focusedViewerId && !(isMobile && placementMode)}
                nodesDraggable={!focusedViewerId && !(isMobile && placementMode)}
              >
                <Controls />
                {isSettingsLoaded && showGrid && <Background color="#aaa" gap={16} />}
                {isSettingsLoaded && showMinimap && <MiniMap />}
                <Panel position="bottom-right">
                  <div className="bg-card rounded-md p-2 text-xs text-muted-foreground">
                    {currentWorkflow ? currentWorkflow.name : "IFCflow - v0.1.0"}
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </ViewerFocusProvider>
        </div>
      </div>
      {editingNode && (
        <PropertiesPanel
          node={editingNode}
          setNodes={setNodes as React.Dispatch<React.SetStateAction<any[]>>}
          setSelectedNode={setEditingNode}
        />
      )}
      <Toaster />
    </div>
  );
}

// Export default component
export default function Home() {
  return (
    <ReactFlowProvider>
      <FlowWithProvider />
    </ReactFlowProvider>
  );
}

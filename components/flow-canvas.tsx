"use client";

import type React from "react";

import { useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { FileUp } from "lucide-react";
import { loadIfcFile } from "@/lib/ifc";
import { useToast } from "@/hooks/use-toast";

// Import node types
import { nodeTypes } from "@/components/nodes";

interface FlowCanvasProps {
  nodes: any[];
  edges: any[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onInit: (instance: any) => void;
  onNodeClick: (event: any, node: any) => void;
  isFileDragging: boolean;
  showGrid: boolean;
  showMinimap: boolean;
  currentWorkflow: any;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  onNodeClick,
  isFileDragging,
  showGrid,
  showMinimap,
  currentWorkflow,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const reactFlowInstance = useReactFlow();

  // Handle dropping new nodes from the sidebar
  const onDragOver = useCallback((event: React.DragEvent) => {
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
    async (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

      // Get the position where the item was dropped
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Check if a node is being dropped from the sidebar
      const nodeType = event.dataTransfer.getData("application/reactflow");
      if (nodeType && nodeType !== "") {
        // Create a new node
        const newNode = {
          id: `${nodeType}-${Date.now()}`,
          type: nodeType,
          position,
          data: { label: `${nodeType.replace("Node", "")}`, properties: {} },
        };

        // Add the new node
        reactFlowInstance.addNodes(newNode);
        return;
      }

      // Check if files are being dropped
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];

        // Check if it's an IFC file
        if (file.name.toLowerCase().endsWith(".ifc")) {
          try {
            // Create a new IFC node
            const newNodeId = `ifcNode-${Date.now()}`;

            // Add the node first with a loading state
            reactFlowInstance.addNodes({
              id: newNodeId,
              type: "ifcNode",
              position,
              data: {
                label: file.name,
                properties: { file: file.name },
                isLoading: true,
              },
            });

            // Load the IFC file
            const model = await loadIfcFile(file);

            // Update the node with the loaded model
            reactFlowInstance.setNodes((nds) =>
              nds.map((node) => {
                if (node.id === newNodeId) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      model,
                      isLoading: false,
                    },
                  };
                }
                return node;
              })
            );

            toast({
              title: "IFC file loaded",
              description: `Successfully loaded ${file.name}`,
            });
          } catch (error: unknown) {
            console.error("Error loading IFC file:", error);
            toast({
              title: "Error loading IFC file",
              description:
                error instanceof Error ? error.message : String(error),
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Invalid file type",
            description: "Only IFC files are supported",
            variant: "destructive",
          });
        }
      }
    },
    [reactFlowInstance, toast]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      onConnect(params);
    },
    [onConnect]
  );

  // --- Listen for quantitiesExtracted messages from the worker and update nodes ---
  useEffect(() => {
    // You may need to import or access your worker instance here
    // For this example, we'll assume a global window.ifcWorker exists
    const worker = (window as any).ifcWorker;
    if (!worker) return;

    const handler = (event: MessageEvent) => {
      // Worker now sends { type: "quantityResults", messageId, data: { groups, unit, total } }
      const { type, messageId, data: quantityData } = event.data;

      if (type === "quantityResults") {
        // Find the node that requested this extraction (by messageId)
        reactFlowInstance.setNodes((nds: any[]) => {
          // First find and update the quantity node
          const updatedNodes = nds.map((node) => {
            // We'll assume the node's data has a messageId or you can match by node.id
            if (
              node.data &&
              (node.data.messageId === messageId || node.id === messageId)
            ) {
              // Update the quantity node
              return {
                ...node,
                data: {
                  ...node.data,
                  inputData: {
                    type: "quantityResults",
                    value: quantityData, // Use the structured data directly
                  },
                },
              };
            }
            return node;
          });

          // Now find ALL watch nodes and update them with a forceUpdate flag
          // This ensures they re-render even if React doesn't detect the change
          return updatedNodes.map(node => {
            if (node.type === 'watchNode') {
              return {
                ...node,
                data: {
                  ...node.data,
                  _forceUpdate: Date.now() // Add a timestamp to force re-render
                }
              };
            }
            return node;
          });
        });

        toast({
          title: "Quantities extracted",
          description: `Received ${Object.keys(quantityData.groups).length} groups (Unit: ${quantityData.unit || 'N/A'})`,
        });
      }
    };
    worker.addEventListener("message", handler);
    return () => worker.removeEventListener("message", handler);
  }, [reactFlowInstance, toast]);

  return (
    <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
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
  );
}

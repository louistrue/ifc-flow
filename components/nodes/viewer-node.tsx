"use client";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  useNodeId,
  NodeProps,
} from "reactflow";
import { CuboidIcon as Cube } from "lucide-react";
import { NodeStatusBadge, NodeStatus } from "../node-status-badge";
import { IfcViewer } from "@/lib/ifc/viewer-utils";
import { ViewerNodeData as BaseViewerNodeData } from "./node-types";

// Extend the base ViewerNodeData with additional properties
interface ExtendedViewerNodeData extends BaseViewerNodeData {
  status?: NodeStatus;
  inputData?: any;
  width?: number;
  height?: number;
}

export const ViewerNode = memo(
  ({ data, id, selected, isConnectable }: NodeProps<ExtendedViewerNodeData>) => {
    const status = data?.status || "working";
    const viewerRef = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<IfcViewer | null>(null);
    const [elementCount, setElementCount] = useState(0);
    const [isResizing, setIsResizing] = useState(false);
    const { setNodes } = useReactFlow();

    // Default sizes with fallback values
    const width = data.width || 220;
    const height = data.height || 200;
    const viewerHeight = Math.max(height - 60, 100); // Subtract space for header and footer

    // Handle window mouse events for resizing
    const startResize = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const onMouseMove = (e: MouseEvent) => {
          const newWidth = Math.max(180, startWidth + e.clientX - startX);
          const newHeight = Math.max(150, startHeight + e.clientY - startY);

          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    width: newWidth,
                    height: newHeight,
                  },
                };
              }
              return node;
            })
          );
        };

        const onMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      },
      [id, width, height, setNodes]
    );

    // Create and clean up the viewer
    useEffect(() => {
      if (!viewerRef.current) return;

      // Create a new viewer instance
      const newViewer = new IfcViewer(viewerRef.current, {
        backgroundColor: "#f5f5f5",
        showGrid: true,
        showAxes: true,
      });

      setViewer(newViewer);

      // Clean up on unmount
      return () => {
        if (newViewer) {
          newViewer.dispose();
        }
      };
    }, []);

    // Update viewer when size changes
    useEffect(() => {
      if (viewer && viewerRef.current) {
        // Update the container size
        viewer.resize();

        // Give a small delay to ensure the resize is completed before fitting
        setTimeout(() => {
          if (viewer) {
            viewer.fitCameraToModel();
          }
        }, 100);
      }
    }, [width, height, viewer]);

    // Handle input data changes
    useEffect(() => {
      if (!viewer || !data.inputData) return;

      try {
        let elements = [];
        let count = 0;

        // Process different types of input data
        if (Array.isArray(data.inputData)) {
          // Direct array of elements
          elements = data.inputData;
          count = elements.length;
        } else if (
          data.inputData.elements &&
          Array.isArray(data.inputData.elements)
        ) {
          // Object with elements array (from model or other nodes)
          elements = data.inputData.elements;
          count = elements.length;
        } else if (data.inputData.model && data.inputData.model.elements) {
          // It might be a model node with a model object
          elements = data.inputData.model.elements;
          count = elements.length;
        } else {
          console.warn(
            "Viewer received unprocessable input data:",
            data.inputData
          );
          return;
        }

        // Filter out elements without proper type information
        elements = elements.filter(
          (el: any) => el && typeof el === "object" && el.type
        );

        // Update count display
        setElementCount(elements.length);

        // Only process if we have actual elements
        if (elements.length === 0) {
          console.log("No valid elements to display in viewer");
          return;
        }

        console.log(`Visualizing ${elements.length} elements in viewer`);

        // Create a model-like structure for the viewer
        const model = {
          id: "visualized-model",
          name: "Visualized Elements",
          elements: elements,
        };

        // Clear previous content
        viewer.clear();

        // Load the model into the viewer
        viewer.loadFromModel(model);

        // Fit camera to the model
        viewer.fitCameraToModel();
      } catch (error) {
        console.error("Error processing data in viewer node:", error);
      }
    }, [data.inputData, viewer]);

    // Used to determine if we should disable dragging - when resizing
    const nodeDraggable = !isResizing;

    return (
      <div
        className={`bg-white border-2 ${selected ? "border-cyan-600" : "border-cyan-500"
          } rounded-md shadow-md relative overflow-hidden ${isResizing ? "nodrag" : ""
          }`}
        style={{ width: `${width}px` }}
        data-nodrag={isResizing ? "true" : undefined}
      >
        <div className="bg-cyan-500 text-white px-3 py-1 flex items-center justify-between gap-2 nodrag-handle">
          <div className="flex items-center gap-2 min-w-0">
            <Cube className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm font-medium truncate">{data.label}</div>
          </div>
          <NodeStatusBadge status={status} />
        </div>
        <div className="p-3">
          <div
            ref={viewerRef}
            className="bg-gray-100 rounded-md flex items-center justify-center overflow-hidden nodrag"
            style={{ height: `${viewerHeight}px` }}
          >
            {!elementCount && (
              <div className="text-xs text-muted-foreground pointer-events-none">
                Connect to elements
              </div>
            )}
          </div>
          <div className="mt-2 text-xs">
            <div className="flex justify-between">
              <span>View Mode:</span>
              <span className="font-medium">
                {data.properties?.viewMode || "Shaded"}
              </span>
            </div>
            {elementCount > 0 && (
              <div className="flex justify-between mt-1">
                <span>Elements:</span>
                <span className="font-medium">{elementCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resize handle - nodrag class prevents ReactFlow drag */}
        <div
          className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize nodrag ${selected ? "text-cyan-600" : "text-gray-400"
            } hover:text-cyan-500`}
          onMouseDown={startResize}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 2L2 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M22 10L10 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M22 18L18 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
      </div>
    );
  }
);

ViewerNode.displayName = "ViewerNode";

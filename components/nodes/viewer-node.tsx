"use client";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import {
  Handle,
  Position,
  useReactFlow,
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
    const viewerRef = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<IfcViewer | null>(null);
    const [elementCount, setElementCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadedFileIdentifier, setLoadedFileIdentifier] = useState<string | null>(null);
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
        setViewer(null);
      };
    }, []);

    // Update viewer when size changes
    useEffect(() => {
      if (viewer && viewerRef.current) {
        // Update the container size
        viewer.resize();

        // Give a small delay to ensure the resize is completed before fitting
        const timer = setTimeout(() => {
          if (viewer) {
            viewer.fitCameraToModel();
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [width, height, viewer]);

    // Handle input data changes - Expecting File object
    useEffect(() => {
      console.log("ViewerNode: Input data effect triggered.", { hasViewer: !!viewer, inputData: data.inputData });
      const fileInput = data.inputData?.file;
      // Create an identifier for the potential new file (or null if no valid file)
      const inputFileIdentifier = fileInput instanceof File ? `${fileInput.name}_${fileInput.lastModified}_${fileInput.size}` : null;

      if (!viewer) {
        console.log("ViewerNode: Viewer instance not ready yet.");
        return;
      }

      // --- Handle invalid or removed input ---
      if (!fileInput || !(fileInput instanceof File) || !fileInput.name.toLowerCase().endsWith(".ifc")) {
        // Only clear and reset state if something *was* loaded previously and input is now invalid/gone
        if (loadedFileIdentifier !== null) {
          console.log("ViewerNode: Invalid or missing input, clearing viewer and resetting state.");
          viewer.clear();
          setLoadedFileIdentifier(null);
          setElementCount(0);
          setIsLoading(false);
          setErrorMessage("Invalid input: Expected IFC file."); // Show error message
        } else {
          // If nothing was loaded and input is invalid/missing, just ensure viewer is clear.
          // viewer.clear(); // clear() is likely called by previous step already, maybe redundant
          setErrorMessage(null); // No error if nothing was expected yet
          setIsLoading(false);
          setElementCount(0);
        }
        return; // Stop processing if input is invalid
      }

      // --- Input is a valid IFC File object ---
      const file = fileInput;
      const newFileIdentifier = inputFileIdentifier; // Already calculated above

      // *** Check if this file is the same as the one already loaded ***
      if (newFileIdentifier === loadedFileIdentifier) {
        console.log(`ViewerNode: File ${file.name} (${newFileIdentifier}) is already loaded. Skipping reload.`);
        // Ensure loading/error states are correct if we skip loading
        setIsLoading(false);
        setErrorMessage(null);
        // Keep elementCount > 0 to show "Model Loaded"
        setElementCount(e => e > 0 ? e : 1); // Set to 1 if it was 0
        return; // Don't reload the same file
      }

      // --- Proceed with loading the new file ---
      console.log(`ViewerNode: New file detected (${file.name}), initiating load.`);
      setIsLoading(true);
      setErrorMessage(null);
      setElementCount(0); // Reset count indicator during load

      viewer.loadIfc(file)
        .then(() => {
          console.log(`IFC loaded successfully in viewer node: ${file.name}`);
          setElementCount(1); // Indicate model loaded
          setLoadedFileIdentifier(newFileIdentifier); // Store identifier of the successfully loaded file
          setErrorMessage(null);
        })
        .catch(error => {
          console.error(`Error loading IFC (${file.name}) in viewer node:`, error);
          setErrorMessage(`Failed to load ${file.name}. See console.`);
          setElementCount(0);
          setLoadedFileIdentifier(null); // Clear identifier on error
          // viewer.clear() is called within loadIfc's catch block
        })
        .finally(() => {
          setIsLoading(false); // Ensure loading is set to false
        });

      // Depend on the file object identifier and the viewer instance
    }, [data.inputData?.file, viewer, loadedFileIdentifier]); // Added loadedFileIdentifier to dependencies

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
          <NodeStatusBadge status={isLoading ? "working" : (errorMessage ? "error" : (elementCount > 0 ? "success" : "waiting"))} />
        </div>
        <div className="p-3">
          <div
            ref={viewerRef}
            className="bg-gray-100 rounded-md flex items-center justify-center overflow-hidden nodrag relative"
            style={{ height: `${viewerHeight}px` }}
          >
            {isLoading && (
              <div className="absolute inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-10">
                <div className="text-white text-sm font-medium">Loading...</div>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="absolute inset-0 bg-red-100 bg-opacity-90 flex items-center justify-center z-10 p-2 text-center">
                <div className="text-red-700 text-xs font-medium">{errorMessage}</div>
              </div>
            )}
            {!elementCount && !isLoading && !errorMessage && (
              <div className="text-xs text-muted-foreground pointer-events-none">
                Connect IFC File
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
            {elementCount > 0 && !isLoading && !errorMessage && (
              <div className="flex justify-between mt-1 text-green-700">
                <span>Status:</span>
                <span className="font-medium">Model Loaded</span>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="flex justify-between mt-1 text-red-700">
                <span>Status:</span>
                <span className="font-medium">Load Error</span>
              </div>
            )}
          </div>
        </div>

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

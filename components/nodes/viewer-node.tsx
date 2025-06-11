"use client";

import { memo, useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import {
  Handle,
  Position,
  useReactFlow,
  NodeProps,
} from "reactflow";
import { CuboidIcon as Cube, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { IfcViewer } from "@/lib/ifc/viewer-utils";
import { ViewerNodeData as BaseViewerNodeData } from "./node-types";
import { registerActiveViewer, unregisterActiveViewer } from "@/lib/ifc/viewer-registry";

// Extend the base ViewerNodeData with additional properties
interface ExtendedViewerNodeData extends BaseViewerNodeData {
  inputData?: any;
  width?: number;
  height?: number;
  viewerState?: {
    isReady?: boolean;
    isLoading?: boolean;
  };
}

export const ViewerNode = memo(
  ({ data, id, selected, isConnectable }: NodeProps<ExtendedViewerNodeData>) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const viewerIdRef = useRef<string | null>(null); // Ref to store this instance's ID for cleanup
    const [viewer, setViewer] = useState<IfcViewer | null>(null);
    const [elementCount, setElementCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadedFileIdentifier, setLoadedFileIdentifier] = useState<string | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [modelIsReady, setModelIsReady] = useState(false);
    const { setNodes } = useReactFlow();
    const viewerLoadingPromiseRef = useRef<Promise<void> | null>(null);

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

    // Function to update node data with viewer state
    const updateNodeViewerState = useCallback((viewer: IfcViewer | null) => {
      const isReady = viewer?.isReady() ?? false;
      const isLoading = !!viewer?.getLoadingPromise();
      console.log(`ViewerNode ${id}: updateNodeViewerState called. isReady=${isReady}, isLoading=${isLoading}`);
      setModelIsReady(isReady);
      setIsLoading(isLoading);

      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                viewerState: {
                  ...(n.data.viewerState || {}),
                  isReady: isReady,
                  isLoading: isLoading,
                },
              },
            };
          }
          return n;
        })
      );
    }, [id, setNodes]);

    // Create and clean up the viewer & register/unregister
    useEffect(() => {
      if (!viewerRef.current) return;
      console.log(`ViewerNode ${id}: Running viewer creation useEffect.`);

      const newViewer = new IfcViewer(viewerRef.current, {
        backgroundColor: "#f5f5f5",
        showGrid: true,
        showAxes: true,
      });
      const viewerId = newViewer.getId();
      viewerIdRef.current = viewerId;
      setViewer(newViewer);
      registerActiveViewer(newViewer);
      updateNodeViewerState(newViewer); // Initial update

      return () => {
        console.log(`ViewerNode ${id}: Cleanup effect for viewer ${viewerIdRef.current}.`);
        const idToUnregister = viewerIdRef.current;
        if (idToUnregister) {
          unregisterActiveViewer(idToUnregister);
          viewerIdRef.current = null;
        }
        if (newViewer) {
          newViewer.dispose();
        }
        setViewer(null);
        updateNodeViewerState(null); // Update state on cleanup
      };
    }, [id, registerActiveViewer, unregisterActiveViewer, updateNodeViewerState]); // Added dependencies

    // Update viewer when size changes
    useEffect(() => {
      if (viewer && viewerRef.current) {
        viewer.resize();
        const timer = setTimeout(() => {
          if (viewer) {
            viewer.fitCameraToModel();
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [width, height, viewer]);

    // Handle input data changes - File input only now
    useEffect(() => {
      console.log("ViewerNode: Input data effect triggered.", { hasViewer: !!viewer, inputData: data.inputData });

      if (!viewer) return;

      const input = data.inputData;
      const fileInput = input?.file ?? (input instanceof File ? input : null);
      const inputFileIdentifier = fileInput instanceof File ? `${fileInput.name}_${fileInput.lastModified}_${fileInput.size}` : null;

      viewer.clearClashVisualizations();

      if (!fileInput || !(fileInput instanceof File) || !fileInput.name.toLowerCase().endsWith(".ifc")) {
        if (loadedFileIdentifier !== null) {
          console.log("ViewerNode: Invalid/missing file input, clearing viewer & state.");
          viewer.clear();
          setLoadedFileIdentifier(null);
          setElementCount(0);
          updateNodeViewerState(viewer); // Reflect viewer is cleared but exists
          setErrorMessage("Invalid input: Expected IFC file.");
        } else {
          setErrorMessage(null);
          setElementCount(0);
          // viewer state already reflects not ready from initial load or previous clear
        }
        return;
      }

      const file = fileInput;
      const newFileIdentifier = inputFileIdentifier;
      if (newFileIdentifier === loadedFileIdentifier) return;

      console.log(`ViewerNode: New file detected (${file.name}), initiating load.`);
      setErrorMessage(null);
      setElementCount(0);
      updateNodeViewerState(viewer); // Reflect viewer is loading

      // Store the promise locally when starting load
      viewerLoadingPromiseRef.current = viewer.loadIfc(file);
      updateNodeViewerState(viewer); // Update state again to reflect promise existence

      viewerLoadingPromiseRef.current
        .then(() => {
          if (!viewerLoadingPromiseRef.current) return; // Check if aborted/cleared
          console.log(`IFC loaded successfully in viewer node: ${file.name}`);
          setElementCount(1);
          setLoadedFileIdentifier(newFileIdentifier);
          setErrorMessage(null);
          updateNodeViewerState(viewer); // Reflect viewer is ready
        })
        .catch(error => {
          if (error.message.includes('aborted')) {
            console.log("ViewerNode: Load aborted, skipping state update.");
            return; // Don't update state if aborted
          }
          console.error(`Error loading IFC (${file.name}) in viewer node:`, error);
          setErrorMessage(`Failed to load ${file.name}. See console.`);
          setElementCount(0);
          setLoadedFileIdentifier(null);
          updateNodeViewerState(viewer); // Reflect viewer is not ready after error
        })
        .finally(() => {
          // Clear local promise ref once done (success, error, or abort)
          viewerLoadingPromiseRef.current = null;
          // Update state one last time - isLoading should now be false
          if (viewer) updateNodeViewerState(viewer);
        });

    }, [data.inputData?.file?.name, data.inputData?.file?.lastModified, data.inputData?.file?.size, viewer, updateNodeViewerState]);

    // Used to determine if we should disable dragging - when resizing
    const nodeDraggable = !isResizing;

    return (
      <div
        className={`bg-white dark:bg-gray-800 border-2 ${selected ? "border-cyan-600 dark:border-cyan-400" : "border-cyan-500 dark:border-cyan-400"
          } rounded-md shadow-md relative`}
        style={{ width: `${width}px` }}
        data-id={id}
      >
        <div className="bg-cyan-500 text-white px-3 py-1 flex items-center justify-between gap-2 nodrag-handle">
          <div className="flex items-center gap-2 min-w-0">
            <Cube className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm font-medium truncate">{data.label || 'Viewer'}</div>
          </div>
          <div className="flex-shrink-0">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isLoading && errorMessage && <AlertCircle className="h-4 w-4 text-red-300" />}
            {!isLoading && !errorMessage && elementCount > 0 && <CheckCircle className="h-4 w-4 text-green-300" />}
          </div>
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
                <span className="font-medium">Error</span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize nodrag ${selected ? "text-cyan-600" : "text-gray-400"
            } hover:text-cyan-500`}
          onMouseDown={startResize}
          draggable={false}
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

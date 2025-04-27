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
import { ClashVisualizer } from "../clash-visualizer";

// Extend the base ViewerNodeData with additional properties
interface ExtendedViewerNodeData extends BaseViewerNodeData {
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
    const [clashResults, setClashResults] = useState<any>(null);
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

      const newViewer = new IfcViewer(viewerRef.current, {
        backgroundColor: "#f5f5f5",
        showGrid: true,
        showAxes: true,
      });

      setViewer(newViewer);

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
        viewer.resize();
        const timer = setTimeout(() => {
          if (viewer) {
            viewer.fitCameraToModel();
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [width, height, viewer]);

    // Handle input data changes - Could be File OR clash results
    useEffect(() => {
      console.log("ViewerNode: Input data effect triggered.", { hasViewer: !!viewer, inputData: data.inputData });

      if (!viewer) {
        console.log("ViewerNode: Viewer instance not ready yet.");
        return;
      }

      const input = data.inputData;
      const fileInput = input?.file; // Potential file object
      const potentialClashResults = input?.type === 'clashResults' ? input.value : null;

      // --- Handle Clash Results Input --- 
      if (potentialClashResults) {
        console.log("ViewerNode: Received clash results, updating state.", potentialClashResults);
        setClashResults(potentialClashResults); // Update clash results state
        // Keep existing model loaded, don't clear viewer
        // Reset error/loading related to file loading if necessary
        setErrorMessage(null);
        setIsLoading(false);
        return; // Stop processing, handled clash results
      } else {
        // If input is not clash results, clear previous clash results state
        setClashResults(null);
      }

      // --- Handle File Input (IFC) --- 
      const inputFileIdentifier = fileInput instanceof File ? `${fileInput.name}_${fileInput.lastModified}_${fileInput.size}` : null;

      if (!fileInput || !(fileInput instanceof File) || !fileInput.name.toLowerCase().endsWith(".ifc")) {
        if (loadedFileIdentifier !== null) {
          console.log("ViewerNode: Invalid/missing file input, clearing viewer & state.");
          viewer.clear();
          setLoadedFileIdentifier(null);
          setElementCount(0);
          setIsLoading(false);
          setErrorMessage("Invalid input: Expected IFC file.");
        } else {
          setErrorMessage(null);
          setIsLoading(false);
          setElementCount(0);
        }
        return;
      }

      const file = fileInput;
      const newFileIdentifier = inputFileIdentifier;

      if (newFileIdentifier === loadedFileIdentifier) {
        console.log(`ViewerNode: File ${file.name} (${newFileIdentifier}) already loaded.`);
        setIsLoading(false);
        setErrorMessage(null);
        setElementCount(e => e > 0 ? e : 1);
        return;
      }

      console.log(`ViewerNode: New file detected (${file.name}), initiating load.`);
      setIsLoading(true);
      setErrorMessage(null);
      setElementCount(0);

      viewer.loadIfc(file)
        .then(() => {
          console.log(`IFC loaded successfully in viewer node: ${file.name}`);
          setElementCount(1);
          setLoadedFileIdentifier(newFileIdentifier);
          setErrorMessage(null);
        })
        .catch(error => {
          console.error(`Error loading IFC (${file.name}) in viewer node:`, error);
          setErrorMessage(`Failed to load ${file.name}. See console.`);
          setElementCount(0);
          setLoadedFileIdentifier(null);
        })
        .finally(() => {
          setIsLoading(false);
        });

    }, [data.inputData, viewer, loadedFileIdentifier]);

    // Used to determine if we should disable dragging - when resizing
    const nodeDraggable = !isResizing;

    return (
      <div
        className={`bg-white dark:bg-gray-800 border-2 ${selected ? "border-cyan-600 dark:border-cyan-400" : "border-cyan-500 dark:border-cyan-400"
          } rounded-md shadow-md relative`}
        style={{ width: `${width}px` }}
        data-id={id}
      >
        <ClashVisualizer viewer={viewer} clashResults={clashResults} />

        <div className="bg-cyan-500 text-white px-3 py-1 flex items-center justify-between gap-2 nodrag-handle">
          <div className="flex items-center gap-2 min-w-0">
            <Cube className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm font-medium truncate">{data.label}</div>
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
                Connect IFC File or Clash Results
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
            {clashResults && !isLoading && !errorMessage && (
              <div className="flex justify-between mt-1 text-blue-700">
                <span>Clashes:</span>
                <span className="font-medium">{clashResults.clashes || 0} detected</span>
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

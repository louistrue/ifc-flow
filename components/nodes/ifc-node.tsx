"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "reactflow";
import { FileUp, Info, Building } from "lucide-react";
import { NodeLoadingIndicator } from "./node-loading-indicator";
import { IfcNodeData as BaseIfcNodeData } from "./node-types";

interface ExtendedIfcNodeData extends BaseIfcNodeData {
  isLoading?: boolean;
  model?: {
    schema?: string;
    project?: { Name?: string };
    elementCounts?: Record<string, number>;
    totalElements?: number;
  };
  error?: string | null;
}

export const IfcNode = memo(({ id, data, isConnectable }: NodeProps<ExtendedIfcNodeData>) => {
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, message: "" });
  const { setNodes } = useReactFlow();
  const [elementsExpanded, setElementsExpanded] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Only allow file drops
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setIsDraggingOver(true);
    }
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingOver(false);

      // Check if files are being dropped
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];

        // Check if it's an IFC file
        if (file.name.toLowerCase().endsWith(".ifc")) {
          // Update this node with the new file and set loading state
          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    label: file.name,
                    properties: {
                      ...node.data.properties,
                      file: file.name,
                    },
                    isLoading: true,
                    model: null, // Clear any previous model
                    error: null, // Clear previous errors
                  },
                };
              }
              return node;
            })
          );

          // Reset progress and set initial loading state
          setProgress({ percentage: 5, message: "Initializing..." }); // Start at 5%

          // Use dynamic import for file uploader
          import("@/lib/ifc/file-uploader").then(({ handleFileUpload }) => {
            handleFileUpload(
              file,
              (model) => {
                console.log("IFC model loaded:", model);
                // Briefly set progress to 100% before updating node state
                setProgress({ percentage: 100, message: "Processing complete" });
                // Update node with model, clear loading/progress
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          model: model, // Store the full model object
                          isLoading: false,
                          error: null,
                        },
                      };
                    }
                    return node;
                  })
                );
                // No need to clear progress here as isLoading: false will hide the indicator
                // setProgress({ percentage: 0, message: "" }); 
              },
              (error) => {
                console.error("Error loading IFC file:", error);
                // Optionally set progress to 100 on error too, or keep last state
                // setProgress({ percentage: 100, message: "Error occurred" });
                // Update node with error, clear loading/progress
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          isLoading: false,
                          error: error.message || "Failed to load IFC",
                        },
                      };
                    }
                    return node;
                  })
                );
                setProgress({ percentage: 0, message: "" }); // Clear progress state on error
              },
              (percentage, message) => {
                // Map reported percentage (0-100) to a visual range (e.g., 5-90)
                const visualPercentage = 5 + (percentage * 0.85); // Maps 0-100 -> 5-90
                setProgress(currentProgress => ({
                  // Ensure visual percentage is monotonic and capped at 90 during progress updates
                  percentage: Math.min(90, Math.max(currentProgress.percentage, visualPercentage)),
                  message: message || currentProgress.message,
                }));
              }
            );
          });
        }
      }
    },
    [id, setNodes]
  );

  const onDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Stop event propagation to prevent the default node selection behavior
    event.stopPropagation();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files ? target.files[0] : null;
      if (file && file.name.toLowerCase().endsWith(".ifc")) {
        // Update this node with the new file and set loading state
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  label: file.name,
                  properties: {
                    ...node.data.properties,
                    file: file.name,
                  },
                  isLoading: true,
                  model: null, // Clear any previous model
                  error: null, // Clear previous errors
                },
              };
            }
            return node;
          })
        );

        // Reset progress and set initial loading state
        setProgress({ percentage: 5, message: "Initializing..." }); // Start at 5%

        // Use dynamic import for file uploader
        import("@/lib/ifc/file-uploader").then(({ handleFileUpload }) => {
          handleFileUpload(
            file,
            (model) => {
              console.log("IFC model loaded:", model);
              // Briefly set progress to 100% before updating node state
              setProgress({ percentage: 100, message: "Processing complete" });
              // Update node with model, clear loading/progress
              setNodes((nodes) =>
                nodes.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        model: model, // Store the full model object
                        isLoading: false,
                        error: null,
                      },
                    };
                  }
                  return node;
                })
              );
              // No need to clear progress here as isLoading: false will hide the indicator
              // setProgress({ percentage: 0, message: "" });
            },
            (error) => {
              console.error("Error loading IFC file:", error);
              // Optionally set progress to 100 on error too, or keep last state
              // setProgress({ percentage: 100, message: "Error occurred" });
              // Update node with error, clear loading/progress
              setNodes((nodes) =>
                nodes.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        isLoading: false,
                        error: error.message || "Failed to load IFC",
                      },
                    };
                  }
                  return node;
                })
              );
              setProgress({ percentage: 0, message: "" }); // Clear progress state on error
            },
            (percentage, message) => {
              // Map reported percentage (0-100) to a visual range (e.g., 5-90)
              const visualPercentage = 5 + (percentage * 0.85); // Maps 0-100 -> 5-90
              setProgress(currentProgress => ({
                // Ensure visual percentage is monotonic and capped at 90 during progress updates
                percentage: Math.min(90, Math.max(currentProgress.percentage, visualPercentage)),
                message: message || currentProgress.message,
              }));
            }
          );
        });
      }
    };
    input.click();
  }, [id, setNodes, setProgress]);

  // Render model info section if model is loaded
  const renderModelInfo = () => {
    if (!data.model) return null;

    const { schema, project, elementCounts, totalElements } = data.model;

    return (
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-blue-600 font-medium">
          <Info className="w-4 h-4" />
          <span>IFC Info</span>
        </div>

        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Schema:</span>
            <span className="font-medium">{schema || "Unknown"}</span>
          </div>

          {project && (
            <div className="flex items-center gap-1">
              <Building className="w-4 h-4 text-gray-500" />
              <span className="flex-1 truncate" title={project.Name}>
                {project.Name || "Unnamed Project"}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-500">Elements:</span>
            <span className="font-medium">{totalElements}</span>
          </div>

          {/* Toggle button for element counts */}
          <button
            className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center"
            onClick={(e) => {
              e.stopPropagation(); // Prevent double-click from triggering
              setElementsExpanded(!elementsExpanded);
            }}
          >
            {elementsExpanded ? "Hide element counts" : "Show element counts"}
            <span className="ml-1">{elementsExpanded ? "▲" : "▼"}</span>
          </button>

          {/* Counts for common element types - only show when expanded */}
          {elementsExpanded && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-1">
              {elementCounts && Object.entries(elementCounts).map(([type, count]) =>
                count > 0 ? (
                  <div key={type} className="flex justify-between">
                    <span className="text-gray-500">
                      {type.replace("Ifc", "")}:
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={dropRef}
      className={`bg-white dark:bg-gray-800 border-2 ${isDraggingOver ? "border-blue-700 bg-blue-50 dark:bg-blue-900 dark:border-blue-500" : "border-blue-500 dark:border-blue-400"
        } rounded-md shadow-md w-60 transition-colors duration-200 ease-in-out relative`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDoubleClick={onDoubleClick}
    >
      <div className="bg-blue-500 text-white px-3 py-1 flex items-center gap-2">
        <FileUp className="h-4 w-4 flex-shrink-0" />
        <div className="text-sm font-medium truncate" title={data.label}>
          {data.label}
        </div>
      </div>
      <NodeLoadingIndicator
        isLoading={data.isLoading || false}
        message="Loading IFC file..."
        progressMessage={progress.message}
        percentage={progress.percentage}
      />
      {!data.isLoading && data.error && (
        <div className="p-3 text-xs text-red-500 break-words">
          Error: {data.error}
        </div>
      )}
      {!data.isLoading && !data.error && data.properties?.file && (
        <div className="p-3 text-xs">
          {data.model ? (
            renderModelInfo()
          ) : (
            <div className="text-muted-foreground text-xs mt-1">
              Loaded. Drag & drop to replace.
            </div>
          )}
        </div>
      )}
      {!data.isLoading && !data.error && !data.properties?.file && (
        <div className="p-3 text-xs text-muted-foreground">
          {isDraggingOver ? "Drop IFC file here" : "No file selected"}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

IfcNode.displayName = "IfcNode";
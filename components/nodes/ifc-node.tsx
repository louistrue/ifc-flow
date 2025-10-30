"use client";

import { memo, useState, useCallback, useRef } from "react";
import { type NodeProps, useReactFlow } from "reactflow";
import { Info, Building } from "lucide-react";
import { IfcNodeData as BaseIfcNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";
import { getElementTypeColor, formatElementType } from "../../lib/ifc/element-utils";

interface ExtendedIfcNodeData extends BaseIfcNodeData {
  isLoading?: boolean;
  model?: {
    schema?: string;
    project?: { Name?: string };
    elementCounts?: Record<string, number>;
    totalElements?: number;
  };
  error?: string | null;
  isEmptyNode?: boolean;
  fileName?: string;
}

export const IfcNode = memo((props: NodeProps<ExtendedIfcNodeData>) => {
  const { id, data } = props;
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

    // Sort elements by count (most common first)
    const sortedElements = elementCounts
      ? Object.entries(elementCounts)
        .filter(([, count]) => (count as number) > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number))
      : [];

    return (
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium mb-2">
          <Info className="w-4 h-4" />
          <span>IFC Model Info</span>
        </div>

        <div className="space-y-2">
          {/* Schema and Project Info */}
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Schema:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{schema || "Unknown"}</span>
            </div>

            {project?.Name && (
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-900 dark:text-gray-100" title={project.Name}>
                  {project.Name}
                </span>
              </div>
            )}
          </div>

          {/* Total Elements */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Elements:</span>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{totalElements?.toLocaleString() || 0}</span>
          </div>

          {/* Element Types Toggle */}
          <button
            className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center justify-center py-1 px-2 rounded border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setElementsExpanded(!elementsExpanded);
            }}
          >
            {elementsExpanded ? "Hide" : "Show"} Element Types
            <span className="ml-1 text-xs">{elementsExpanded ? "▲" : "▼"}</span>
          </button>

          {/* Element Types List */}
          {elementsExpanded && sortedElements.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Element Breakdown ({sortedElements.length} types)
              </div>
              {sortedElements.slice(0, 15).map(([type, count]) => {
                const percentage = totalElements ? ((count as number) / totalElements) * 100 : 0;
                return (
                  <div key={type} className="flex items-center justify-between py-0.5 px-1 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getElementTypeColor(type)}`}
                        title={`${type} elements`}
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate" title={type}>
                        {formatElementType(type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {(count as number).toLocaleString()}
                      </span>
                      {percentage >= 1 && (
                        <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                          ({percentage.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {sortedElements.length > 15 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                  ... and {sortedElements.length - 15} more types
                </div>
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
      className={`w-full h-full ${isDraggingOver ? "border-blue-700 bg-blue-50 dark:bg-blue-900 dark:border-blue-500" : ""} transition-colors duration-200 ease-in-out relative`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDoubleClick={onDoubleClick}
    >
      <BaseNode
        {...props}
        isLoading={data.isLoading || false}
        error={data.error || null}
        progress={progress.percentage > 0 ? progress : null}
        showStatusIcon={true}
        theme={nodeThemes.ifc}
        hideInputHandle={true}
      >
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
        {!data.isLoading && !data.error && !data.properties?.file && !data.isEmptyNode && (
          <div className="p-3 text-xs text-muted-foreground">
            {isDraggingOver ? "Drop IFC file here" : "No file selected"}
          </div>
        )}
        {!data.isLoading && !data.error && data.isEmptyNode && (
          <div className="p-3">
            <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              IFC file needs to be reloaded
            </div>
            {data.fileName && (
              <div className="text-xs text-muted-foreground mt-1">
                Original file: {data.fileName}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Drag & drop or click to load IFC file
            </div>
          </div>
        )}
      </BaseNode>
    </div>
  );
});

IfcNode.displayName = "IfcNode";
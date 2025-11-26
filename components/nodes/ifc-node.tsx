"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "reactflow";
import { FileUp, Info, Building } from "lucide-react";
import { NodeLoadingIndicator } from "./node-loading-indicator";
import { IfcNodeData as BaseIfcNodeData } from "./node-types";
import { getElementTypeColor, formatElementType } from "../../lib/ifc/element-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

export const IfcNode = memo(({ id, data, isConnectable, selected }: NodeProps<ExtendedIfcNodeData>) => {
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, message: "" });
  const { setNodes } = useReactFlow();
  const [showPreview, setShowPreview] = useState(false);

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
              },
              (error) => {
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
            },
            (error) => {
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

  // Render model info preview for popover
  const renderModelPreview = () => {
    if (!data.model) return null;

    const { schema, project, elementCounts, totalElements } = data.model;

    // Sort elements by count (most common first)
    const sortedElements = elementCounts
      ? Object.entries(elementCounts)
        .filter(([, count]) => (count as number) > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number))
      : [];

    return (
      <div className="w-full max-w-md overflow-hidden">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold mb-4 text-base">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span>IFC Model Info</span>
        </div>

        <div className="space-y-4">
          {/* Schema and Project Info */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Schema</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{schema || "Unknown"}</span>
            </div>

            {project?.Name && (
              <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <Building className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate" title={project.Name}>
                  {project.Name}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Elements</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalElements?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Element Types List */}
          {sortedElements.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-600">
                Element breakdown ({sortedElements.length} classes)
              </div>
              <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                {sortedElements.slice(0, 20).map(([type, count]) => {
                  const percentage = totalElements ? ((count as number) / totalElements) * 100 : 0;
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between py-2 px-2.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getElementTypeColor(type)} ring-2 ring-white dark:ring-gray-800`}
                          title={`${type} elements`}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" title={type}>
                          {formatElementType(type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                          {(count as number).toLocaleString()}
                        </span>
                        {percentage >= 1 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-14 text-right tabular-nums">
                            ({percentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sortedElements.length > 20 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 italic">
                    + {sortedElements.length - 20} more types
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={dropRef}
      className={`bg-white dark:bg-gray-800 border-2 ${selected ? 'ring-2 ring-blue-300 dark:ring-blue-500' : ''
        } ${isDraggingOver
          ? "border-blue-700 bg-blue-50 dark:bg-blue-900 dark:border-blue-500"
          : "border-blue-500 dark:border-blue-400"
        } rounded-md shadow-md min-w-48 max-w-64 transition-all duration-200 ease-in-out`}
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
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Schema</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{data.model.schema || "Unknown"}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Elements</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{data.model.totalElements?.toLocaleString() || 0}</span>
              </div>
              <Popover open={showPreview} onOpenChange={setShowPreview}>
                <PopoverTrigger asChild>
                  <button
                    className="w-full mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-1.5 px-2 rounded border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-150"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setShowPreview(true)}
                    onMouseLeave={() => setShowPreview(false)}
                  >
                    View Details
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-4 shadow-xl max-w-md"
                  align="start"
                  side="right"
                  onMouseEnter={() => setShowPreview(true)}
                  onMouseLeave={() => setShowPreview(false)}
                >
                  {renderModelPreview()}
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              Loaded. Drag & drop to replace.
            </div>
          )}
        </div>
      )}
      {!data.isLoading && !data.error && !data.properties?.file && !data.isEmptyNode && (
        <div className="p-3 text-xs text-gray-500 dark:text-gray-400">
          {isDraggingOver ? "Drop IFC file here" : "Drag & drop or double-click"}
        </div>
      )}
      {!data.isLoading && !data.error && data.isEmptyNode && (
        <div className="p-3">
          <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
            File needs reload
          </div>
          {data.fileName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={data.fileName}>
              {data.fileName}
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Drag & drop or double-click
          </div>
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
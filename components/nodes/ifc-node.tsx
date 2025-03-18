"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { FileUp, Loader2, Info, Building } from "lucide-react";

export const IfcNode = memo(({ id, data, isConnectable }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, message: "" });
  const { setNodes } = useReactFlow();

  const onDragOver = useCallback((event) => {
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
    (event) => {
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
                  },
                };
              }
              return node;
            })
          );

          // Load the IFC file
          import("@/lib/ifc/file-uploader").then(({ handleFileUpload }) => {
            // Set initial progress
            setProgress({ percentage: 0, message: "Starting..." });

            // Handle file upload with progress
            handleFileUpload(
              file,
              // On success
              (model) => {
                console.log("IFC model loaded:", model);
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
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
              },
              // On error
              (error) => {
                console.error("Error loading IFC file:", error);
                setProgress({ percentage: 0, message: "" });
                // Reset loading state on error
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          isLoading: false,
                          error: error.message,
                        },
                      };
                    }
                    return node;
                  })
                );
              },
              // On progress
              (percentage, message) => {
                setProgress({ percentage, message: message || "" });
              }
            );
          });
        }
      }
    },
    [id, setNodes]
  );

  // Render model info section if model is loaded
  const renderModelInfo = () => {
    if (!data.model) return null;

    const { schema, project, elementCounts, totalElements } = data.model;

    return (
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-blue-600 font-medium">
          <Info className="w-3 h-3" />
          <span>IFC Info</span>
        </div>

        <div className="mt-1 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Schema:</span>
            <span className="font-medium">{schema || "Unknown"}</span>
          </div>

          {project && (
            <div className="flex items-start gap-1">
              <Building className="w-3 h-3 mt-0.5 text-gray-500" />
              <span className="flex-1 truncate" title={project.Name}>
                {project.Name || "Unnamed Project"}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-500">Elements:</span>
            <span className="font-medium">{totalElements}</span>
          </div>

          {/* Counts for common element types */}
          <div className="grid grid-cols-2 gap-x-1 text-xs leading-tight">
            {Object.entries(elementCounts || {}).map(([type, count]) =>
              count > 0 ? (
                <div key={type} className="flex justify-between">
                  <span className="text-gray-500">
                    {type.replace("Ifc", "")}:
                  </span>
                  <span>{count}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`bg-white border-2 ${
        isDraggingOver ? "border-blue-700 bg-blue-50" : "border-blue-500"
      } rounded-md w-48 shadow-md transition-colors`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="bg-blue-500 text-white px-3 py-1 flex items-center gap-2">
        <FileUp className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        {data.isLoading ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading IFC file...</span>
            </div>
            {progress.percentage > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">{progress.message}</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        ) : data.error ? (
          <div className="text-red-500">{data.error}</div>
        ) : data.properties?.file ? (
          <div className="space-y-1">
            <div className="truncate">{data.properties.file}</div>
            {data.model ? (
              renderModelInfo()
            ) : (
              <div className="text-blue-500 text-xs mt-1">
                Drag & drop a new IFC file to replace
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">
            {isDraggingOver ? "Drop IFC file here" : "No file selected"}
          </div>
        )}
      </div>
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

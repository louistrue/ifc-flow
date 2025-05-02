"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { FileUp, Info, Building } from "lucide-react";
import { NodeLoadingIndicator } from "./node-loading-indicator";

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
                    error: null, // Clear previous errors
                  },
                };
              }
              return node;
            })
          );

          // Reset progress for the new file
          setProgress({ percentage: 0, message: "" });

          // Use dynamic import for file uploader
          import("@/lib/ifc/file-uploader").then(({ handleFileUpload }) => {
            handleFileUpload(
              file,
              (model) => {
                console.log("IFC model loaded:", model);

                // No spatial processing here - just pass the raw model data
                // Let each node (like SpatialHierarchyNode) do its own processing

                // Just do basic cleanup and model validation
                // This ensures all elements have consistent IDs and properties structure
                if (model.elements) {
                  // Ensure all elements have an id
                  model.elements.forEach((element) => {
                    if (!element.id && element.properties?.GlobalId) {
                      element.id = element.properties.GlobalId;
                    } else if (!element.id) {
                      element.id = `el-${
                        element.expressId || Date.now()
                      }-${Math.random().toString(36).substring(2, 9)}`;
                    }

                    // Ensure all elements have a properties object
                    if (!element.properties) {
                      element.properties = {};
                    }
                  });

                  console.log(`Validated ${model.elements.length} elements`);
                }

                // Update node with model, clear loading/progress
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          model: model, // Store the full model object with minimal pre-processing
                          isLoading: false,
                          error: null,
                        },
                      };
                    }
                    return node;
                  })
                );
                setProgress({ percentage: 0, message: "" }); // Clear progress state
              },
              (error) => {
                console.error("Error loading IFC file:", error);
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
                setProgress({ percentage: 0, message: "" }); // Clear progress state
              },
              (percentage, message) => {
                // Update local progress state
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
        <FileUp className="h-4 w-4 flex-shrink-0" />
        <div className="text-sm font-medium truncate" title={data.label}>
          {data.label}
        </div>
      </div>
      <NodeLoadingIndicator
        isLoading={data.isLoading}
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

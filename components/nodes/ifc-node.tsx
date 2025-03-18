"use client"

import { memo, useState, useCallback } from "react"
import { Handle, Position, useReactFlow } from "reactflow"
import { FileUp, Loader2 } from "lucide-react"

export const IfcNode = memo(({ id, data, isConnectable }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const { setNodes } = useReactFlow()

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()

    // Only allow file drops
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy"
      setIsDraggingOver(true)
    }
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDraggingOver(false)
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDraggingOver(false)

      // Check if files are being dropped
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0]

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
                  },
                }
              }
              return node
            }),
          )

          // Load the IFC file
          import("@/lib/ifc-utils").then(({ loadIfcFile }) => {
            loadIfcFile(file)
              .then((model) => {
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
                      }
                    }
                    return node
                  }),
                )
              })
              .catch((error) => {
                console.error("Error loading IFC file:", error)
                // Reset loading state on error
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          isLoading: false,
                        },
                      }
                    }
                    return node
                  }),
                )
              })
          })
        }
      }
    },
    [id, setNodes],
  )

  return (
    <div
      className={`bg-white border-2 ${isDraggingOver ? "border-blue-700 bg-blue-50" : "border-blue-500"} rounded-md w-48 shadow-md transition-colors`}
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
          <div className="flex items-center gap-2 text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading IFC file...</span>
          </div>
        ) : data.properties?.file ? (
          <div className="truncate">{data.properties.file}</div>
        ) : (
          <div className="text-muted-foreground">{isDraggingOver ? "Drop IFC file here" : "No file selected"}</div>
        )}
        {data.model && (
          <div className="mt-1 text-green-600 text-xs">{data.model.elements?.length || 0} elements loaded</div>
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
  )
})

IfcNode.displayName = "IfcNode"


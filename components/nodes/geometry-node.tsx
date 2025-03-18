"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Box } from "lucide-react"

export const GeometryNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-green-500 rounded-md w-48 shadow-md">
      <div className="bg-green-500 text-white px-3 py-1 flex items-center gap-2">
        <Box className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="flex justify-between mb-1">
          <span>Element Type:</span>
          <span className="font-medium">{data.properties?.elementType || "All"}</span>
        </div>
        <div className="flex justify-between">
          <span>Include Openings:</span>
          <span className="font-medium">{data.properties?.includeOpenings === "false" ? "No" : "Yes"}</span>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
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

GeometryNode.displayName = "GeometryNode"


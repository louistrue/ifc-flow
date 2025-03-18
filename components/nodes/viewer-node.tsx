"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Eye } from "lucide-react"

export const ViewerNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-cyan-500 rounded-md w-48 shadow-md">
      <div className="bg-cyan-500 text-white px-3 py-1 flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3">
        <div className="bg-gray-100 rounded-md h-24 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">3D Preview</div>
        </div>
        <div className="mt-2 text-xs">
          <div className="flex justify-between">
            <span>View Mode:</span>
            <span className="font-medium">{data.properties?.viewMode || "Shaded"}</span>
          </div>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
    </div>
  )
})

ViewerNode.displayName = "ViewerNode"


"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { GitBranch } from "lucide-react"

export const RelationshipNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-violet-500 rounded-md w-48 shadow-md">
      <div className="bg-violet-500 text-white px-3 py-1 flex items-center gap-2">
        <GitBranch className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Relationship:</span>
            <span className="font-medium truncate">{data.properties?.relationType || "Containment"}</span>
          </div>
          <div className="flex justify-between">
            <span>Direction:</span>
            <span className="font-medium">{data.properties?.direction || "Outgoing"}</span>
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

RelationshipNode.displayName = "RelationshipNode"


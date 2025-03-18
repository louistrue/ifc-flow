"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Filter } from "lucide-react"

export const FilterNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-md w-48 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        {data.properties?.property ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Property:</span>
              <span className="font-medium">{data.properties.property}</span>
            </div>
            <div className="flex justify-between">
              <span>Operator:</span>
              <span className="font-medium">{data.properties?.operator || "equals"}</span>
            </div>
            <div className="flex justify-between">
              <span>Value:</span>
              <span className="font-medium">{data.properties?.value || ""}</span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No filter configured</div>
        )}
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

FilterNode.displayName = "FilterNode"


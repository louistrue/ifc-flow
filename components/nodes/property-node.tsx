"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Edit } from "lucide-react"

export const PropertyNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-pink-500 rounded-md w-48 shadow-md">
      <div className="bg-pink-500 text-white px-3 py-1 flex items-center gap-2">
        <Edit className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        {data.properties?.propertyName ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Action:</span>
              <span className="font-medium">{data.properties?.action || "Get"}</span>
            </div>
            <div className="flex justify-between">
              <span>Property:</span>
              <span className="font-medium">{data.properties.propertyName}</span>
            </div>
            {data.properties.action === "set" || data.properties.action === "add" ? (
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-medium">{data.properties.propertyValue || "From Input"}</span>
              </div>
            ) : null}
            {data.properties.useValueInput && <div className="text-xs text-blue-500 mt-1">Using value from input</div>}
          </div>
        ) : (
          <div className="text-muted-foreground">No property configured</div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
      {/* Second input for property values */}
      {(data.properties?.action === "set" || data.properties?.action === "add") && (
        <Handle
          type="target"
          position={Position.Top}
          id="valueInput"
          style={{ background: "#7c3aed", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
      )}
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

PropertyNode.displayName = "PropertyNode"


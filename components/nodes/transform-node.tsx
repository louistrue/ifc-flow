"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Move } from "lucide-react"

export const TransformNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-orange-500 rounded-md w-48 shadow-md">
      <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
        <Move className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="grid grid-cols-3 gap-1 mb-1">
          <div className="text-center">
            <span className="block text-muted-foreground">Tx</span>
            <span>{data.properties?.translateX || "0"}</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Ty</span>
            <span>{data.properties?.translateY || "0"}</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Tz</span>
            <span>{data.properties?.translateZ || "0"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="text-center">
            <span className="block text-muted-foreground">Rx</span>
            <span>{data.properties?.rotateX || "0"}°</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Ry</span>
            <span>{data.properties?.rotateY || "0"}°</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Rz</span>
            <span>{data.properties?.rotateZ || "0"}°</span>
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

TransformNode.displayName = "TransformNode"


"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Sliders } from "lucide-react"
import { ParameterNodeData } from "./node-types";
export const ParameterNode = memo(({ data, isConnectable }: NodeProps<ParameterNodeData>) => {
  const paramType = data.properties?.paramType || "number"
  const value = data.properties?.value || (paramType === "number" ? "0" : "")

  return (
    <div className="bg-white border-2 border-yellow-500 rounded-md w-48 shadow-md">
      <div className="bg-yellow-500 text-white px-3 py-1 flex items-center gap-2">
        <Sliders className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="font-medium">{paramType}</span>
          </div>
          <div className="flex justify-between">
            <span>Value:</span>
            <span className="font-medium truncate">{value}</span>
          </div>
          {paramType === "number" && data.properties?.range && (
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-medium">
                {data.properties.range.min} - {data.properties.range.max}
              </span>
            </div>
          )}
        </div>
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

ParameterNode.displayName = "ParameterNode"


"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Calculator } from "lucide-react"
import { QuantityNodeData } from "./node-types";

export const QuantityNode = memo(({ data, isConnectable }: NodeProps<QuantityNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-amber-500 dark:border-amber-400 rounded-md w-48 shadow-md">
      <div className="bg-amber-500 text-white px-3 py-1 flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label || "Quantity Take-Off"}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Quantity Type:</span>
            <span className="font-medium">{data.properties?.quantityType || "Area"}</span>
          </div>
          <div className="flex justify-between">
            <span>Group By:</span>
            <span className="font-medium">{data.properties?.groupBy || "None"}</span>
          </div>
          <div className="flex justify-between">
            <span>Unit:</span>
            <span className="font-medium text-gray-500 italic">Auto (from IFC)</span>
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

QuantityNode.displayName = "QuantityNode"


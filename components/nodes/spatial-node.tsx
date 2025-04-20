"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Layers } from "lucide-react"
import { SpatialNodeData } from "./node-types";

export const SpatialNode = memo(({ data, isConnectable }: NodeProps<SpatialNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-lime-500 dark:border-lime-400 rounded-md w-48 shadow-md">
      <div className="bg-lime-500 text-white px-3 py-1 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Query Type:</span>
            <span className="font-medium">{data.properties?.queryType || "Contained In"}</span>
          </div>
          {data.properties?.queryType === "within-distance" ? (
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="font-medium">{data.properties.distance || "1.0"}m</span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between text-xs text-blue-500">
            <span>Elements</span>
            <span>Reference</span>
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
        type="target"
        position={Position.Top}
        id="reference"
        style={{ background: "#7c3aed", width: 8, height: 8 }}
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

SpatialNode.displayName = "SpatialNode"


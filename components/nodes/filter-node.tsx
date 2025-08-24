"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Filter } from "lucide-react"
import { FilterNodeData } from "./node-types";

export const FilterNode = memo(({ data, isConnectable }: NodeProps<FilterNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-48 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        {data.properties ? (
          data.properties.filterType === "ifcClass" ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>IFC Class:</span>
                <span className="font-medium">{data.properties.ifcClass || "Any"}</span>
              </div>
            </div>
          ) : data.properties.filterType === "storey" ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Storey:</span>
                <span className="font-medium">{data.properties.storey || "Any"}</span>
              </div>
            </div>
          ) : data.properties.filterType === "material" ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Material:</span>
                <span className="font-medium">{data.properties.material || "Any"}</span>
              </div>
            </div>
          ) : data.properties.pset || data.properties.property || data.properties.value ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Pset:</span>
                <span className="font-medium">{data.properties.pset || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span>Property:</span>
                <span className="font-medium">{data.properties.property || "Any"}</span>
              </div>
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-medium">{data.properties.value || ""}</span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No filter configured</div>
          )
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


"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { BarChart } from "lucide-react"
import { AnalysisNodeData } from "./node-types"

export const AnalysisNode = memo(({ data, isConnectable }: NodeProps<AnalysisNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-red-500 dark:border-red-400 rounded-md w-48 shadow-md">
      <div className="bg-red-500 text-white px-3 py-1 flex items-center gap-2">
        <BarChart className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        {data.properties?.analysisType ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Analysis:</span>
              <span className="font-medium">{data.properties.analysisType}</span>
            </div>
            {data.properties.analysisType === "clash" ? (
              <div className="flex justify-between">
                <span>Tolerance:</span>
                <span className="font-medium">{data.properties.tolerance || "10"}mm</span>
              </div>
            ) : null}
            {data.properties.analysisType === "space" && data.properties.metric ? (
              <div className="flex justify-between">
                <span>Metric:</span>
                <span className="font-medium">{data.properties.metric}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between text-xs text-blue-500">
              <span>Primary</span>
              <span>Reference</span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No analysis configured</div>
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

AnalysisNode.displayName = "AnalysisNode"


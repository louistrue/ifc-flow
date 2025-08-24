"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { BarChart3 } from "lucide-react";
import { AnalysisNodeData } from "./node-types";

export const AnalysisNode = memo(({ data, isConnectable }: NodeProps<AnalysisNodeData>) => {
  const metric = data.properties?.metric || "room_assignment";

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-cyan-500 dark:border-cyan-400 rounded-md w-64 shadow-md">
      <div className="bg-cyan-500 text-white px-3 py-1 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label || "Analysis"}</div>
      </div>
      <div className="p-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span>Metric:</span>
          <span className="font-medium truncate">{metric}</span>
        </div>
        {data.result && (
          <div className="text-green-600 dark:text-green-400">Analysis complete</div>
        )}
        {data.error && (
          <div className="text-red-600 dark:text-red-400">{data.error}</div>
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
  );
});

AnalysisNode.displayName = "AnalysisNode";


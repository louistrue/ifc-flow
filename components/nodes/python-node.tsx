"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FileCode } from "lucide-react";
import { NodeLoadingIndicator } from "./node-loading-indicator";
import { PythonNodeData as BasePythonNodeData } from "./node-types";

interface ExtendedPythonNodeData extends BasePythonNodeData {
  isLoading?: boolean;
  error?: string | null;
  output?: any;
}

export const PythonNode = memo(({ data, isConnectable }: NodeProps<ExtendedPythonNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-48 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
        <FileCode className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label || "Python"}</div>
      </div>
      <NodeLoadingIndicator
        isLoading={data.isLoading || false}
        message="Running Python..."
      />
      {!data.isLoading && data.error && (
        <div className="p-3 text-xs text-red-500 break-words">Error: {data.error}</div>
      )}
      {!data.isLoading && !data.error && data.output && (
        <div className="p-3 text-xs break-words">
          {typeof data.output === "string" ? data.output : JSON.stringify(data.output)}
        </div>
      )}
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

PythonNode.displayName = "PythonNode";

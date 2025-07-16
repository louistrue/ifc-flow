"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Code } from "lucide-react"
import { PythonScriptNodeData } from "./node-types"

export const PythonScriptNode = memo(({ data, isConnectable }: NodeProps<PythonScriptNodeData>) => {
  const script = data.properties?.script || ""
  const preview = script.split("\n")[0] || "Double-click to edit"

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-48 shadow-md">
      <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
        <Code className="h-4 w-4" />
        <div className="text-sm font-medium truncate" title={data.label}>{data.label}</div>
      </div>
      <div className="p-3 text-xs font-mono truncate" title={script}>{preview}</div>
      <Handle type="target" position={Position.Left} id="input" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
    </div>
  )
})

PythonScriptNode.displayName = "PythonScriptNode"

"use client"

import { memo, useState } from "react"
import { Handle, Position, NodeProps, useReactFlow } from "reactflow"
import { Code } from "lucide-react"
import { PythonScriptNodeData } from "./node-types"

export const PythonScriptNode = memo(({ data, id, isConnectable }: NodeProps<PythonScriptNodeData>) => {
  const [expanded, setExpanded] = useState(false)
  const { setNodes } = useReactFlow()
  const script = data.properties?.script || ""
  const consoleText = data.console || ""

  const updateScript = (value: string) => {
    setNodes(nodes =>
      nodes.map(n =>
        n.id === id
          ? { ...n, data: { ...n.data, properties: { ...n.data.properties, script: value } } }
          : n
      )
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-60 shadow-md">
      <div
        className="bg-orange-500 text-white px-3 py-1 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <div className="text-sm font-medium truncate" title={data.label}>{data.label}</div>
        </div>
        <div className="text-xs">{expanded ? "Hide" : "Edit"}</div>
      </div>
      {expanded && (
        <div className="p-2 text-xs space-y-2">
          <textarea
            className="w-full h-32 p-1 font-mono border rounded bg-gray-50 dark:bg-gray-900"
            value={script}
            onChange={e => updateScript(e.target.value)}
            placeholder="# Write Python script here"
          />
          <div className="h-24 overflow-auto bg-black text-green-300 font-mono p-1 rounded whitespace-pre-wrap">
            {consoleText || "Console output"}
          </div>
        </div>
      )}
      <Handle type="target" position={Position.Left} id="input" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
    </div>
  )
})

PythonScriptNode.displayName = "PythonScriptNode"

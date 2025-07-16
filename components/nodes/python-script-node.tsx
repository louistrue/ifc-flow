"use client"

import { memo, useState } from "react"
import { Handle, Position, NodeProps, useReactFlow } from "reactflow"
import { Code } from "lucide-react"
import { PythonScriptNodeData } from "./node-types"
import { PythonEditorDialog } from "@/components/dialogs/python-editor-dialog"

export const PythonScriptNode = memo(({ data, id, isConnectable }: NodeProps<PythonScriptNodeData>) => {
  const [editorOpen, setEditorOpen] = useState(false)
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
    <>
      <div
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditorOpen(true)
        }}
        className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-48 shadow-md"
      >
        <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
          <Code className="h-4 w-4" />
          <div className="text-sm font-medium truncate">{data.label}</div>
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
      <PythonEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        script={script}
        onChange={updateScript}
        consoleText={consoleText}
      />
    </>
  )
})

PythonScriptNode.displayName = "PythonScriptNode"

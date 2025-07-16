"use client"

import { memo, useState } from "react"
import { Handle, Position, NodeProps, useReactFlow } from "reactflow"
import { Code } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { PythonScriptNodeData } from "./node-types"

export const PythonScriptNode = memo(({ data, id, isConnectable }: NodeProps<PythonScriptNodeData>) => {
  const [open, setOpen] = useState(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        onDoubleClick={() => setOpen(true)}
        className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-48 shadow-md"
      >
        <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
          <Code className="h-4 w-4" />
          <div className="text-sm font-medium truncate" title={data.label}">{data.label}</div>
        </div>
        <div className="p-3 text-xs text-muted-foreground">Double-click to edit script</div>
        <Handle type="target" position={Position.Left} id="input" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
        <Handle type="source" position={Position.Right} id="output" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
      </div>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Python Script</DialogTitle>
          <DialogDescription>Execute custom Python code on the input data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={script}
            onChange={e => updateScript(e.target.value)}
            placeholder="# Write Python script here"
            className="font-mono h-40"
          />
          <div className="h-24 overflow-auto bg-black text-green-300 font-mono p-1 rounded whitespace-pre-wrap">
            {consoleText || "Console output"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})

PythonScriptNode.displayName = "PythonScriptNode"

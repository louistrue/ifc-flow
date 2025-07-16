"use client"

import { memo, useState } from "react"
import { Handle, Position, NodeProps, useReactFlow } from "reactflow"
import { Code } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PythonScriptNodeData } from "./node-types"

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
        className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-48 shadow-md cursor-pointer"
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditorOpen(true)
        }}
      >
        <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
          <Code className="h-4 w-4" />
          <div className="text-sm font-medium truncate" title={data.label}>{data.label}</div>
        </div>
        <div className="p-2 text-xs min-h-[40px]">
          {script ? (
            <pre className="whitespace-pre-wrap max-h-10 overflow-hidden">{script}</pre>
          ) : (
            <span className="text-muted-foreground">Double-click to edit</span>
          )}
        </div>
        <Handle type="target" position={Position.Left} id="input" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
        <Handle type="source" position={Position.Right} id="output" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Python Script</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <textarea
              className="w-full h-40 p-2 font-mono border rounded bg-gray-50 dark:bg-gray-900"
              value={script}
              onChange={(e) => updateScript(e.target.value)}
              placeholder="# Write Python script here"
            />
            <div className="h-24 overflow-auto bg-black text-green-300 font-mono p-1 rounded whitespace-pre-wrap">
              {consoleText || "Console output"}
            </div>
            <div className="text-right">
              <Button size="sm" onClick={() => setEditorOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

PythonScriptNode.displayName = "PythonScriptNode"

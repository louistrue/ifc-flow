"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface PythonEditorDialogProps {
  node: any | null
  onClose: () => void
  onSave: (id: string, script: string) => void
}

const keywords = /(\b(?:def|class|return|import|from|as|if|else|elif|for|while|try|except|with|lambda|yield|in|is|not|and|or|pass|break|continue|print)\b)/g

function highlight(code: string) {
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  html = html.replace(/(#[^\n]*)/g, '<span class="text-gray-400">$1</span>')
  html = html.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-600">$1</span>')
  html = html.replace(keywords, '<span class="text-purple-600 font-semibold">$1</span>')
  return html
}

export function PythonEditorDialog({ node, onClose, onSave }: PythonEditorDialogProps) {
  const [script, setScript] = useState("")

  useEffect(() => {
    if (node) {
      setScript(node.data?.properties?.script || "")
    }
  }, [node])

  if (!node) return null

  return (
    <Dialog open={!!node} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Python Script</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="relative">
            <pre className="pointer-events-none absolute inset-0 p-2 text-xs font-mono whitespace-pre-wrap overflow-auto" dangerouslySetInnerHTML={{ __html: highlight(script) }} />
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="relative bg-transparent text-transparent caret-white font-mono text-xs h-40 overflow-auto"
              style={{ zIndex: 1 }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(node.id, script)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


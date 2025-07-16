"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"

interface PythonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  script: string
  onChange: (value: string) => void
  consoleText?: string
}

export function PythonEditorDialog({
  open,
  onOpenChange,
  script,
  onChange,
  consoleText,
}: PythonEditorDialogProps) {
  const [localScript, setLocalScript] = useState(script)

  useEffect(() => {
    setLocalScript(script)
  }, [script])

  const handleSave = () => {
    onChange(localScript)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Python Script</DialogTitle>
          <DialogDescription>
            Modify the script and apply your changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="py-script">Script</Label>
            <Textarea
              id="py-script"
              value={localScript}
              onChange={(e) => setLocalScript(e.target.value)}
              className="font-mono h-40"
              placeholder="# Write Python script here"
            />
          </div>
          {consoleText !== undefined && (
            <div className="space-y-2">
              <Label>Console</Label>
              <ScrollArea className="h-24">
                <pre className="bg-black text-green-300 font-mono p-2 rounded whitespace-pre-wrap">
                  {consoleText || "Console output"}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

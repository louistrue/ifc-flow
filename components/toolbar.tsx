"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Save, FolderOpen, Play, Download, Undo, Redo, Settings, HelpCircle, Pause, BookOpen } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { OpenFileDialog } from "@/components/dialogs/open-file-dialog"
import { SaveFileDialog } from "@/components/dialogs/save-file-dialog"
import { SaveWorkflowDialog } from "@/components/dialogs/save-workflow-dialog"
import { SettingsDialog } from "@/components/dialogs/settings-dialog"
import { HelpDialog } from "@/components/dialogs/help-dialog"
import { ExportDialog } from "@/components/dialogs/export-dialog"
import { WorkflowLibrary } from "@/components/workflow-library"
import { toast } from "sonner"
import type { Workflow } from "@/lib/workflow-storage"

export function Toolbar({
  onOpenFile,
  onSaveWorkflow,
  onRunWorkflow,
  onExportResults,
  onLoadWorkflow,
  isRunning,
  setIsRunning,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  getFlowObject,
  currentWorkflow,
}) {
  const [openFileDialogOpen, setOpenFileDialogOpen] = useState(false)
  const [saveFileDialogOpen, setSaveFileDialogOpen] = useState(false)
  const [saveWorkflowDialogOpen, setSaveWorkflowDialogOpen] = useState(false)
  const [workflowLibraryOpen, setWorkflowLibraryOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const handleOpenFile = (file) => {
    onOpenFile(file)
    setOpenFileDialogOpen(false)
    toast.success("File opened", {
      description: `Successfully opened ${file.name}`,
    })
  }

  const handleSaveWorkflow = (filename) => {
    // Instead of using reactFlowInstance directly, we get the flow object from the parent
    const flowData = getFlowObject()
    onSaveWorkflow(filename, flowData)
    setSaveFileDialogOpen(false)
    toast.success("Workflow saved", {
      description: `Successfully saved as ${filename}`,
    })
  }

  const handleSaveToLibrary = (workflow: Workflow) => {
    toast.success("Workflow saved to library", {
      description: `${workflow.name} has been saved to your workflow library`,
    })
  }

  const handleLoadWorkflow = (workflow: Workflow) => {
    onLoadWorkflow(workflow)
    toast.success("Workflow loaded", {
      description: `${workflow.name} has been loaded successfully`,
    })
  }

  const handleRunWorkflow = () => {
    if (isRunning) {
      setIsRunning(false)
      toast.info("Execution paused", {
        description: "Workflow execution has been paused",
      })
    } else {
      setIsRunning(true)
      onRunWorkflow()
      toast.success("Execution started", {
        description: "Workflow execution has started",
      })
    }
  }

  const handleExport = (format, filename) => {
    onExportResults(format, filename)
    setExportDialogOpen(false)
    toast.success("Export complete", {
      description: `Results exported as ${filename}`,
    })
  }

  const handleUndo = () => {
    onUndo()
    toast.info("Undo", {
      description: "Last action undone",
    })
  }

  const handleRedo = () => {
    onRedo()
    toast.info("Redo", {
      description: "Action redone",
    })
  }

  return (
    <>
      <div className="flex items-center justify-between border-b p-2 bg-card">
        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setOpenFileDialogOpen(true)}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open IFC File</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setSaveFileDialogOpen(true)}>
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save Workflow</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setWorkflowLibraryOpen(true)}>
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Workflow Library</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="mx-2 text-muted-foreground">|</span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleUndo} disabled={!canUndo}>
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleRedo} disabled={!canRedo}>
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant={isRunning ? "destructive" : "outline"}
            size="sm"
            className="gap-1"
            onClick={handleRunWorkflow}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Stop" : "Run"}
          </Button>

          <Button variant="outline" size="sm" className="gap-1" onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4" />
            Export
          </Button>

          <Button variant="outline" size="sm" className="gap-1" onClick={() => setSaveWorkflowDialogOpen(true)}>
            <Save className="h-4 w-4" />
            Save to Library
          </Button>

          <span className="mx-2 text-muted-foreground">|</span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setSettingsDialogOpen(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setHelpDialogOpen(true)}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <OpenFileDialog open={openFileDialogOpen} onOpenChange={setOpenFileDialogOpen} onFileSelected={handleOpenFile} />

      <SaveFileDialog open={saveFileDialogOpen} onOpenChange={setSaveFileDialogOpen} onSave={handleSaveWorkflow} />

      <SaveWorkflowDialog
        open={saveWorkflowDialogOpen}
        onOpenChange={setSaveWorkflowDialogOpen}
        onSave={handleSaveToLibrary}
        flowData={getFlowObject()}
        existingWorkflow={currentWorkflow}
      />

      <WorkflowLibrary
        open={workflowLibraryOpen}
        onOpenChange={setWorkflowLibraryOpen}
        onLoadWorkflow={handleLoadWorkflow}
      />

      <SettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />

      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />

      <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} onExport={handleExport} />
    </>
  )
}


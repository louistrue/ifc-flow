"use client"

import { useState } from "react"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  MenubarCheckboxItem,
} from "@/components/ui/menubar"
import { Button } from "@/components/ui/button"
import { Play, Pause } from "lucide-react"
import { OpenFileDialog } from "@/components/dialogs/open-file-dialog"
import { SaveWorkflowDialog } from "@/components/dialogs/save-workflow-dialog"
import { SettingsDialog } from "@/components/dialogs/settings-dialog"
import { HelpDialog } from "@/components/dialogs/help-dialog"
import { WorkflowLibrary } from "@/components/workflow-library"
import { toast } from "sonner"
import type { Workflow } from "@/lib/workflow-storage"
import { formatKeyCombination, useKeyboardShortcuts } from "@/lib/keyboard-shortcuts"

export function AppMenubar({
  onOpenFile,
  onSaveWorkflow,
  onRunWorkflow,
  onLoadWorkflow,
  isRunning,
  setIsRunning,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  getFlowObject,
  currentWorkflow,
  reactFlowInstance,
  showGrid,
  setShowGrid,
  showMinimap,
  setShowMinimap,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onDelete,
}) {
  const [openFileDialogOpen, setOpenFileDialogOpen] = useState(false)
  const [saveWorkflowDialogOpen, setSaveWorkflowDialogOpen] = useState(false)
  const [workflowLibraryOpen, setWorkflowLibraryOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const { shortcuts } = useKeyboardShortcuts()

  // Find shortcut by ID
  const findShortcut = (id) => {
    return shortcuts.find((s) => s.id === id)
  }

  // Get shortcut display text
  const getShortcutDisplay = (id) => {
    const shortcut = findShortcut(id)
    return shortcut ? formatKeyCombination(shortcut.keys) : ""
  }

  const handleOpenFile = (file) => {
    onOpenFile(file)
    setOpenFileDialogOpen(false)
    toast.success("File opened", {
      description: `Successfully opened ${file.name}`,
    })
  }

  const handleSaveToLibrary = (workflow: Workflow) => {
    toast.success("Workflow saved to library", {
      description: `${workflow.name} has been saved to your workflow library`,
    })
  }

  const handleSaveLocally = (workflow: Workflow) => {
    // Save workflow to local file
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `${workflow.name.replace(/\s+/g, "-").toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Workflow saved locally", {
      description: `${workflow.name} has been saved to your device`,
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

  const handleUndo = () => {
    if (canUndo) {
      onUndo()
      toast.info("Undo", {
        description: "Last action undone",
      })
    }
  }

  const handleRedo = () => {
    if (canRedo) {
      onRedo()
      toast.info("Redo", {
        description: "Action redone",
      })
    }
  }

  // View functions
  const handleZoomIn = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom()
      reactFlowInstance.zoomTo(Math.min(zoom + 0.2, 2))
      toast.info("Zoom In", {
        description: "Canvas zoomed in",
      })
    }
  }

  const handleZoomOut = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom()
      reactFlowInstance.zoomTo(Math.max(zoom - 0.2, 0.2))
      toast.info("Zoom Out", {
        description: "Canvas zoomed out",
      })
    }
  }

  const handleFitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 })
      toast.info("Fit View", {
        description: "Canvas adjusted to fit all nodes",
      })
    }
  }

  const handleToggleGrid = () => {
    setShowGrid(!showGrid)
  }

  const handleToggleMinimap = () => {
    setShowMinimap(!showMinimap)
  }

  return (
    <>
      <div className="flex items-center justify-between border-b p-1 bg-card">
        <Menubar className="border-none">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setOpenFileDialogOpen(true)} data-open-file-dialog-trigger>
                Open IFC File<MenubarShortcut>{getShortcutDisplay("open-file")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Save Workflow</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => setSaveWorkflowDialogOpen(true)} data-save-workflow-dialog-trigger>
                    Save to Library<MenubarShortcut>{getShortcutDisplay("save-workflow")}</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      const flowData = getFlowObject()
                      // Create a temporary workflow object for local saving
                      const tempWorkflow = {
                        id: currentWorkflow?.id || crypto.randomUUID(),
                        name: currentWorkflow?.name || "Untitled Workflow",
                        description: currentWorkflow?.description || "",
                        tags: currentWorkflow?.tags || [],
                        createdAt: currentWorkflow?.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        flowData,
                      }
                      handleSaveLocally(tempWorkflow)
                    }}
                    data-save-locally-trigger
                  >
                    Save Locally
                    <MenubarShortcut>{getShortcutDisplay("save-workflow-locally")}</MenubarShortcut>
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarItem onClick={() => setWorkflowLibraryOpen(true)} data-workflow-library-trigger>
                Open Workflow Library<MenubarShortcut>{getShortcutDisplay("open-workflow-library")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => setSettingsDialogOpen(true)}>Settings</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Exit</MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleUndo} disabled={!canUndo}>
                Undo<MenubarShortcut>{getShortcutDisplay("undo")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleRedo} disabled={!canRedo}>
                Redo<MenubarShortcut>{getShortcutDisplay("redo")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={onCut}>
                Cut<MenubarShortcut>{getShortcutDisplay("cut")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onCopy}>
                Copy<MenubarShortcut>{getShortcutDisplay("copy")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onPaste}>
                Paste<MenubarShortcut>{getShortcutDisplay("paste")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={onSelectAll}>
                Select All<MenubarShortcut>{getShortcutDisplay("select-all")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={onDelete}>
                Delete Selected<MenubarShortcut>{getShortcutDisplay("delete")}</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={handleZoomIn}>
                Zoom In<MenubarShortcut>{getShortcutDisplay("zoom-in")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleZoomOut}>
                Zoom Out<MenubarShortcut>{getShortcutDisplay("zoom-out")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handleFitView}>
                Fit View<MenubarShortcut>{getShortcutDisplay("fit-view")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarCheckboxItem checked={showGrid} onCheckedChange={handleToggleGrid}>
                Show Grid<MenubarShortcut>{getShortcutDisplay("toggle-grid")}</MenubarShortcut>
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={showMinimap} onCheckedChange={handleToggleMinimap}>
                Show Minimap<MenubarShortcut>{getShortcutDisplay("toggle-minimap")}</MenubarShortcut>
              </MenubarCheckboxItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setHelpDialogOpen(true)} data-help-dialog-trigger>
                Documentation<MenubarShortcut>{getShortcutDisplay("help")}</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  setHelpDialogOpen(true)
                  // Set active tab to shortcuts
                  setTimeout(() => {
                    const shortcutsTab = document.querySelector('[data-tab="shortcuts"]') as HTMLElement
                    if (shortcutsTab) shortcutsTab.click()
                  }, 100)
                }}
              >
                Keyboard Shortcuts<MenubarShortcut>{getShortcutDisplay("keyboard-shortcuts")}</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>About Grasshopper for IFC</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className="flex items-center space-x-2">
          <Button
            variant={isRunning ? "destructive" : "default"}
            size="sm"
            className="gap-1"
            onClick={handleRunWorkflow}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Stop" : "Run"}
          </Button>

          {currentWorkflow && <div className="text-sm font-medium mr-2">{currentWorkflow.name}</div>}
        </div>
      </div>

      <OpenFileDialog open={openFileDialogOpen} onOpenChange={setOpenFileDialogOpen} onFileSelected={handleOpenFile} />

      <SaveWorkflowDialog
        open={saveWorkflowDialogOpen}
        onOpenChange={setSaveWorkflowDialogOpen}
        onSave={handleSaveToLibrary}
        onSaveLocally={handleSaveLocally}
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
    </>
  )
}


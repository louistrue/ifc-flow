"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
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
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import { Play, Pause, Check, Menu, MoreVertical } from "lucide-react";
import { OpenFileDialog } from "@/components/dialogs/open-file-dialog";
import { SaveWorkflowDialog } from "@/components/dialogs/save-workflow-dialog";
import { SettingsDialog } from "@/components/dialogs/settings-dialog";
import { HelpDialog } from "@/components/dialogs/help-dialog";
import { AboutDialog } from "@/components/dialogs/about-dialog";
import { WorkflowLibrary } from "@/components/workflow-library";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Workflow } from "@/lib/workflow-storage";
import { cleanWorkflowData } from "@/lib/workflow-storage";
import {
  formatKeyCombination,
  useKeyboardShortcuts,
} from "@/lib/keyboard-shortcuts";
import { ReactFlowInstance } from "reactflow";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// Define proper types for the component props
interface AppMenubarProps {
  onOpenFile: (file: File) => void;
  onSaveWorkflow: (workflow: Workflow) => void;
  onRunWorkflow: () => void;
  onLoadWorkflow: (workflow: Workflow) => void;
  isRunning: boolean;
  setIsRunning: (isRunning: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  getFlowObject: () => any;
  currentWorkflow: Workflow | null;
  reactFlowInstance: ReactFlowInstance | null;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  onSelectAll: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onToggleSidebar: () => void;
  sidebarOpen?: boolean;
}

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
  onToggleSidebar,
  sidebarOpen = false,
}: AppMenubarProps) {
  const [openFileDialogOpen, setOpenFileDialogOpen] = useState(false);
  const [saveWorkflowDialogOpen, setSaveWorkflowDialogOpen] = useState(false);
  const [workflowLibraryOpen, setWorkflowLibraryOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const { shortcuts } = useKeyboardShortcuts();
  const { theme, setTheme } = useTheme();

  // Find shortcut by ID
  const findShortcut = (id: string) => {
    return shortcuts.find((s) => s.id === id);
  };

  // Get shortcut display text
  const getShortcutDisplay = (id: string) => {
    const shortcut = findShortcut(id);
    return shortcut ? formatKeyCombination(shortcut.keys) : "";
  };

  const handleOpenFile = (file: File) => {
    onOpenFile(file);
    setOpenFileDialogOpen(false);
    toast({
      title: "File opened",
      description: `Successfully opened ${file.name}`,
    });
  };

  const handleSaveToLibrary = (workflow: Workflow) => {
    onSaveWorkflow(workflow);
    toast({
      title: "Workflow saved to library",
      description: `${workflow.name} has been saved to your workflow library`,
    });
  };

  const handleSaveLocally = (workflow: Workflow) => {
    // Save workflow to local file
    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Workflow saved locally",
      description: `${workflow.name} has been saved to your device`,
    });
  };

  const handleLoadWorkflow = (workflow: Workflow) => {
    onLoadWorkflow(workflow);
    toast({
      title: "Workflow loaded",
      description: `${workflow.name} has been loaded successfully`,
    });
  };

  const handleRunWorkflow = () => {
    if (isRunning) {
      setIsRunning(false);
      toast({
        title: "Execution paused",
        description: "Workflow execution has been paused",
      });
    } else {
      // Make sure workflow is actually executed
      setIsRunning(true);

      // Ensure we call onRunWorkflow properly
      console.log("Starting workflow execution...");

      try {
        onRunWorkflow();
        toast({
          title: "Execution started",
          description: "Workflow execution has started",
        });
      } catch (error: unknown) {
        console.error("Error executing workflow:", error);
        let errorMessage = "Unknown error";

        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === "object" && "toString" in error) {
          errorMessage = error.toString();
        }

        toast({
          title: "Execution error",
          description: `Error: ${errorMessage}`,
          variant: "destructive",
        });
        setIsRunning(false);
      }
    }
  };

  const handleUndo = () => {
    if (canUndo) {
      onUndo();
      toast({
        title: "Undo",
        description: "Last action undone",
        variant: "default",
      });
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      onRedo();
      toast({
        title: "Redo",
        description: "Action redone",
        variant: "default",
      });
    }
  };

  // View functions
  const handleZoomIn = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom();
      reactFlowInstance.zoomTo(Math.min(zoom + 0.2, 2));
      toast({
        title: "Zoom In",
        description: "Canvas zoomed in",
      });
    }
  };

  const handleZoomOut = () => {
    if (reactFlowInstance) {
      const zoom = reactFlowInstance.getZoom();
      reactFlowInstance.zoomTo(Math.max(zoom - 0.2, 0.2));
      toast({
        title: "Zoom Out",
        description: "Canvas zoomed out",
      });
    }
  };

  const handleFitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
      toast({
        title: "Fit View",
        description: "Canvas adjusted to fit all nodes",
      });
    }
  };

  const handleToggleGrid = () => {
    setShowGrid(!showGrid);
  };

  const handleToggleMinimap = () => {
    setShowMinimap(!showMinimap);
  };

  const MenuContent = () => (
    <Menubar className="border-none flex-col md:flex-row">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onClick={() => setOpenFileDialogOpen(true)}
            data-open-file-dialog-trigger
          >
            Open IFC File
            <MenubarShortcut>{getShortcutDisplay("open-file")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            onClick={() => setSaveWorkflowDialogOpen(true)}
            data-save-workflow-dialog-trigger
          >
            Save Workflow
            <MenubarShortcut>{getShortcutDisplay("save-workflow")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            onClick={() => setWorkflowLibraryOpen(true)}
            data-workflow-library-trigger
          >
            Open Workflow Library
            <MenubarShortcut>{getShortcutDisplay("open-workflow-library")}</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleUndo} disabled={!canUndo}>
            Undo
            <MenubarShortcut>{getShortcutDisplay("undo")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleRedo} disabled={!canRedo}>
            Redo
            <MenubarShortcut>{getShortcutDisplay("redo")}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onCut}>
            Cut
            <MenubarShortcut>{getShortcutDisplay("cut")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onCopy}>
            Copy
            <MenubarShortcut>{getShortcutDisplay("copy")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onPaste}>
            Paste
            <MenubarShortcut>{getShortcutDisplay("paste")}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onSelectAll}>
            Select All
            <MenubarShortcut>{getShortcutDisplay("select-all")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onDelete}>
            Delete Selected
            <MenubarShortcut>{getShortcutDisplay("delete")}</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleZoomIn}>
            Zoom In
            <MenubarShortcut>{getShortcutDisplay("zoom-in")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleZoomOut}>
            Zoom Out
            <MenubarShortcut>{getShortcutDisplay("zoom-out")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleFitView}>
            Fit View
            <MenubarShortcut>{getShortcutDisplay("fit-view")}</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarCheckboxItem
            checked={showGrid}
            onCheckedChange={handleToggleGrid}
          >
            Show Grid
            <MenubarShortcut>{getShortcutDisplay("toggle-grid")}</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={showMinimap}
            onCheckedChange={handleToggleMinimap}
          >
            Show Minimap
            <MenubarShortcut>{getShortcutDisplay("toggle-minimap")}</MenubarShortcut>
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Theme</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarSub>
                <MenubarSubTrigger>Boring</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => setTheme('light')}>
                    Light
                    {theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
                  </MenubarItem>
                  <MenubarItem onClick={() => setTheme('dark')}>
                    Dark
                    {theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub>
                <MenubarSubTrigger>Less Boring</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => setTheme('tokyo-night-light')}>
                    Light
                    {theme === 'tokyo-night-light' && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </MenubarItem>
                  <MenubarItem onClick={() => setTheme('tokyo-night-dark')}>
                    Dark
                    {theme === 'tokyo-night-dark' && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onClick={() => setHelpDialogOpen(true)}
            data-help-dialog-trigger
          >
            Documentation
            <MenubarShortcut>{getShortcutDisplay("help")}</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            onClick={() => {
              setHelpDialogOpen(true);
              setTimeout(() => {
                const shortcutsTab = document.querySelector(
                  '[data-tab="shortcuts"]'
                ) as HTMLElement;
                if (shortcutsTab) shortcutsTab.click();
              }, 100);
            }}
          >
            Keyboard Shortcuts
            <MenubarShortcut>
              {getShortcutDisplay("keyboard-shortcuts")}
            </MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => setAboutDialogOpen(true)}>
            About IFCflow
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );

  const RunSection = () => (
    <div className="flex items-center space-x-2">
      <Button
        variant={isRunning ? "destructive" : "default"}
        size="sm"
        className="gap-1"
        onClick={handleRunWorkflow}
        data-testid="run-workflow-button"
      >
        {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isRunning ? "Stop" : "Run"}
      </Button>

      {currentWorkflow && (
        <div className="text-sm font-medium mr-2">{currentWorkflow.name}</div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop menu */}
      <div className="hidden md:flex items-center justify-between border-b p-1 bg-card">
        <MenuContent />
        <RunSection />
      </div>

      {/* Mobile header */}
      <div className="flex md:hidden items-center justify-between border-b p-2 bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          {currentWorkflow && (
            <span className="text-sm font-medium">{currentWorkflow.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isRunning ? "destructive" : "default"}
            size="icon"
            onClick={handleRunWorkflow}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="sr-only">Run</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile menu sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="top" className="p-2 pt-4">
          <MenuContent />
          <div className="mt-4">
            <RunSection />
          </div>
        </SheetContent>
      </Sheet>

      <OpenFileDialog
        open={openFileDialogOpen}
        onOpenChange={setOpenFileDialogOpen}
        onFileSelected={handleOpenFile}
      />

      <SaveWorkflowDialog
        open={saveWorkflowDialogOpen}
        onOpenChange={setSaveWorkflowDialogOpen}
        onSave={handleSaveToLibrary}
        onSaveLocally={handleSaveLocally}
        flowData={cleanWorkflowData(getFlowObject())}
        existingWorkflow={currentWorkflow}
      />

      <WorkflowLibrary
        open={workflowLibraryOpen}
        onOpenChange={setWorkflowLibraryOpen}
        onLoadWorkflow={handleLoadWorkflow}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />

      <AboutDialog open={aboutDialogOpen} onOpenChange={setAboutDialogOpen} />
    </>
  );
}

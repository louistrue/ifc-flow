"use client"

import { useMemo } from "react"

export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  keys: string
  category: "file" | "edit" | "view" | "workflow" | "navigation"
  action: () => void
}

// Helper to detect platform
export const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

// Format key combination for display
export function formatKeyCombination(keys: string): string {
  if (isMac) {
    return keys
      .replace(/mod/gi, "⌘")
      .replace(/meta/gi, "⌘")
      .replace(/ctrl/gi, "⌘")
      .replace(/alt/gi, "⌥")
      .replace(/shift/gi, "⇧")
      .replace(/\+/g, " ")
  }
  return keys
    .replace(/mod/gi, "Ctrl")
    .replace(/meta/gi, "Ctrl")
    .replace(/ctrl/gi, "Ctrl")
    .replace(/alt/gi, "Alt")
    .replace(/shift/gi, "Shift")
    .replace(/\+/g, "+")
}

// Parse key combination for hotkey library
export function parseKeyCombination(keys: string): string {
  return keys.toLowerCase().replace(/\s+/g, "+")
}

// Default keyboard shortcuts
function createDefaultShortcuts(): KeyboardShortcut[] {
  const mod = isMac ? "meta" : "ctrl"
  return [
    {
      id: "open-file",
      name: "Open File",
      description: "Open an IFC file",
      keys: `${mod}+o`,
      category: "file",
      action: () => {},
    },
    {
      id: "save-workflow",
      name: "Save Workflow",
      description: "Save current workflow to library",
      keys: `${mod}+s`,
      category: "file",
      action: () => {},
    },
    {
      id: "save-workflow-locally",
      name: "Save Workflow Locally",
      description: "Save current workflow to local file",
      keys: `${mod}+shift+s`,
      category: "file",
      action: () => {},
    },
    {
      id: "open-workflow-library",
      name: "Open Workflow Library",
      description: "Open the workflow library",
      keys: `${mod}+l`,
      category: "file",
      action: () => {},
    },
    {
      id: "undo",
      name: "Undo",
      description: "Undo last action",
      keys: `${mod}+z`,
      category: "edit",
      action: () => {},
    },
    {
      id: "redo",
      name: "Redo",
      description: "Redo last undone action",
      keys: `${mod}+shift+z`,
      category: "edit",
      action: () => {},
    },
    {
      id: "select-all",
      name: "Select All",
      description: "Select all nodes",
      keys: `${mod}+a`,
      category: "edit",
      action: () => {},
    },
    {
      id: "cut",
      name: "Cut",
      description: "Cut selected nodes",
      keys: `${mod}+x`,
      category: "edit",
      action: () => {},
    },
    {
      id: "copy",
      name: "Copy",
      description: "Copy selected nodes",
      keys: `${mod}+c`,
      category: "edit",
      action: () => {},
    },
    {
      id: "paste",
      name: "Paste",
      description: "Paste copied nodes",
      keys: `${mod}+v`,
      category: "edit",
      action: () => {},
    },
    {
      id: "delete",
      name: "Delete",
      description: "Delete selected nodes",
      keys: "delete",
      category: "edit",
      action: () => {},
    },
    {
      id: "run-workflow",
      name: "Run Workflow",
      description: "Run the current workflow",
      keys: "f5",
      category: "workflow",
      action: () => {},
    },
    {
      id: "zoom-in",
      name: "Zoom In",
      description: "Zoom in the canvas",
      keys: `${mod}+=`,
      category: "view",
      action: () => {},
    },
    {
      id: "zoom-out",
      name: "Zoom Out",
      description: "Zoom out the canvas",
      keys: `${mod}+-`,
      category: "view",
      action: () => {},
    },
    {
      id: "fit-view",
      name: "Fit View",
      description: "Fit all nodes in view",
      keys: `${mod}+0`,
      category: "view",
      action: () => {},
    },
    {
      id: "toggle-grid",
      name: "Toggle Grid",
      description: "Toggle grid visibility",
      keys: `${mod}+g`,
      category: "view",
      action: () => {},
    },
    {
      id: "toggle-minimap",
      name: "Toggle Minimap",
      description: "Toggle minimap visibility",
      keys: isMac ? "meta+shift+m" : `${mod}+m`,
      category: "view",
      action: () => {},
    },
    {
      id: "help",
      name: "Help",
      description: "Open help dialog",
      keys: "f1",
      category: "navigation",
      action: () => {},
    },
    {
      id: "keyboard-shortcuts",
      name: "Keyboard Shortcuts",
      description: "Show keyboard shortcuts",
      keys: "shift+f1",
      category: "navigation",
      action: () => {},
    },
  ]
}

export const defaultShortcuts = createDefaultShortcuts()

// Hook to access shortcuts
export function useKeyboardShortcuts() {
  const shortcuts = useMemo(() => defaultShortcuts, [])
  return { shortcuts }
}


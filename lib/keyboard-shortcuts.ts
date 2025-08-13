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
  typeof navigator !== "undefined" && navigator.platform
    ? navigator.platform.toUpperCase().includes("MAC")
    : false

// Format key combination for display
export function formatKeyCombination(keys: string): string {
  let formatted = keys
  if (isMac) {
    formatted = formatted
      .replace(/mod/gi, "⌘")
      .replace(/cmd/gi, "⌘")
      .replace(/ctrl/gi, "⌃")
      .replace(/alt/gi, "⌥")
      .replace(/shift/gi, "⇧")
    return formatted.replace(/\+/g, " ")
  }
  formatted = formatted
    .replace(/mod/gi, "Ctrl")
    .replace(/cmd/gi, "Ctrl")
    .replace(/ctrl/gi, "Ctrl")
    .replace(/alt/gi, "Alt")
    .replace(/shift/gi, "Shift")
  return formatted.replace(/\+/g, "+")
}

// Parse key combination for hotkey library
export function parseKeyCombination(keys: string): string {
  return keys
    .toLowerCase()
    .replace(/cmd/g, "meta")
    .replace(/\s+/g, "+")
}

// Default keyboard shortcuts
export function getDefaultShortcuts(): KeyboardShortcut[] {
  const mod = isMac ? "cmd" : "ctrl"
  const shortcuts: KeyboardShortcut[] = [
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
      description: "Save current workflow",
      keys: `${mod}+s`,
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
      id: "group",
      name: "Group Nodes",
      description: "Group selected nodes",
      keys: `${mod}+g`,
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
      keys: `${mod}+shift+g`,
      category: "view",
      action: () => {},
    },
    {
      id: "toggle-minimap",
      name: "Toggle Minimap",
      description: "Toggle minimap visibility",
      keys: isMac ? "cmd+shift+m" : "ctrl+m",
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

  return shortcuts
}

// Hook to retrieve the keyboard shortcuts
export function useKeyboardShortcuts() {
  const shortcuts = useMemo(() => getDefaultShortcuts(), [])
  return { shortcuts }
}


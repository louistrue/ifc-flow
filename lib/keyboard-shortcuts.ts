"use client"

import { useEffect, useState } from "react"

export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  defaultKeys: string
  keys: string
  category: "file" | "edit" | "view" | "workflow" | "navigation"
  action: () => void
}

// Helper to detect platform
export const isMac = typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false

// Format key combination for display
export function formatKeyCombination(keys: string): string {
  if (isMac) {
    return keys.replace(/ctrl/gi, "⌘").replace(/alt/gi, "⌥").replace(/shift/gi, "⇧").replace(/\+/g, " ")
  } else {
    return keys.replace(/ctrl/gi, "Ctrl").replace(/alt/gi, "Alt").replace(/shift/gi, "Shift").replace(/\+/g, "+")
  }
}

// Parse key combination for hotkey library
export function parseKeyCombination(keys: string): string {
  return keys.toLowerCase().replace(/\s+/g, "+")
}

// Default keyboard shortcuts
export const defaultShortcuts: KeyboardShortcut[] = [
  {
    id: "open-file",
    name: "Open File",
    description: "Open an IFC file",
    defaultKeys: "ctrl+o",
    keys: "ctrl+o",
    category: "file",
    action: () => { },
  },
  {
    id: "save-workflow",
    name: "Save Workflow",
    description: "Save current workflow to library",
    defaultKeys: "ctrl+s",
    keys: "ctrl+s",
    category: "file",
    action: () => { },
  },
  {
    id: "save-workflow-locally",
    name: "Save Workflow Locally",
    description: "Save current workflow to local file",
    defaultKeys: "ctrl+shift+s",
    keys: "ctrl+shift+s",
    category: "file",
    action: () => { },
  },
  {
    id: "open-workflow-library",
    name: "Open Workflow Library",
    description: "Open the workflow library",
    defaultKeys: "ctrl+l",
    keys: "ctrl+l",
    category: "file",
    action: () => { },
  },
  {
    id: "undo",
    name: "Undo",
    description: "Undo last action",
    defaultKeys: "ctrl+z",
    keys: "ctrl+z",
    category: "edit",
    action: () => { },
  },
  {
    id: "redo",
    name: "Redo",
    description: "Redo last undone action",
    defaultKeys: "ctrl+shift+z",
    keys: "ctrl+shift+z",
    category: "edit",
    action: () => { },
  },
  {
    id: "select-all",
    name: "Select All",
    description: "Select all nodes",
    defaultKeys: "ctrl+a",
    keys: "ctrl+a",
    category: "edit",
    action: () => { },
  },
  {
    id: "cut",
    name: "Cut",
    description: "Cut selected nodes",
    defaultKeys: "ctrl+x",
    keys: "ctrl+x",
    category: "edit",
    action: () => { },
  },
  {
    id: "copy",
    name: "Copy",
    description: "Copy selected nodes",
    defaultKeys: "ctrl+c",
    keys: "ctrl+c",
    category: "edit",
    action: () => { },
  },
  {
    id: "paste",
    name: "Paste",
    description: "Paste copied nodes",
    defaultKeys: "ctrl+v",
    keys: "ctrl+v",
    category: "edit",
    action: () => { },
  },
  {
    id: "delete",
    name: "Delete",
    description: "Delete selected nodes",
    defaultKeys: "delete",
    keys: "delete",
    category: "edit",
    action: () => { },
  },
  {
    id: "run-workflow",
    name: "Run Workflow",
    description: "Run the current workflow",
    defaultKeys: "f5",
    keys: "f5",
    category: "workflow",
    action: () => { },
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    description: "Zoom in the canvas",
    defaultKeys: "ctrl+=",
    keys: "ctrl+=",
    category: "view",
    action: () => { },
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    description: "Zoom out the canvas",
    defaultKeys: "ctrl+-",
    keys: "ctrl+-",
    category: "view",
    action: () => { },
  },
  {
    id: "fit-view",
    name: "Fit View",
    description: "Fit all nodes in view",
    defaultKeys: "ctrl+0",
    keys: "ctrl+0",
    category: "view",
    action: () => { },
  },
  {
    id: "toggle-grid",
    name: "Toggle Grid",
    description: "Toggle grid visibility",
    defaultKeys: "ctrl+g",
    keys: "ctrl+g",
    category: "view",
    action: () => { },
  },
  {
    id: "toggle-minimap",
    name: "Toggle Minimap",
    description: "Toggle minimap visibility",
    defaultKeys: "ctrl+m",
    keys: "ctrl+m",
    category: "view",
    action: () => { },
  },
  {
    id: "help",
    name: "Help",
    description: "Open help dialog",
    defaultKeys: "f1",
    keys: "f1",
    category: "navigation",
    action: () => { },
  },
  {
    id: "keyboard-shortcuts",
    name: "Keyboard Shortcuts",
    description: "Show keyboard shortcuts",
    defaultKeys: "shift+f1",
    keys: "shift+f1",
    category: "navigation",
    action: () => { },
  },
]

// Load shortcuts from localStorage
export function loadShortcuts(): KeyboardShortcut[] {
  if (typeof window === "undefined") return defaultShortcuts

  try {
    const savedShortcuts = localStorage.getItem("keyboard-shortcuts")
    if (savedShortcuts) {
      const parsed = JSON.parse(savedShortcuts) as { id: string; keys: string }[]

      // Merge with defaults to ensure we have all shortcuts
      return defaultShortcuts.map((defaultShortcut) => {
        const savedShortcut = parsed.find((s) => s.id === defaultShortcut.id)
        if (savedShortcut) {
          return {
            ...defaultShortcut,
            keys: savedShortcut.keys,
          }
        }
        return defaultShortcut
      })
    }
  } catch (error) {
    console.error("Error loading keyboard shortcuts:", error)
  }

  return defaultShortcuts
}

// Save shortcuts to localStorage
export function saveShortcuts(shortcuts: KeyboardShortcut[]): void {
  if (typeof window === "undefined") return

  try {
    // Only save id and keys to keep it minimal
    const toSave = shortcuts.map(({ id, keys }) => ({ id, keys }))
    localStorage.setItem("keyboard-shortcuts", JSON.stringify(toSave))
  } catch (error) {
    console.error("Error saving keyboard shortcuts:", error)
  }
}

// Hook to use keyboard shortcuts
export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(defaultShortcuts)

  useEffect(() => {
    setShortcuts(loadShortcuts())
  }, [])

  const updateShortcut = (id: string, newKeys: string) => {
    const updated = shortcuts.map((shortcut) => (shortcut.id === id ? { ...shortcut, keys: newKeys } : shortcut))
    setShortcuts(updated)
    saveShortcuts(updated)
  }

  const resetShortcut = (id: string) => {
    const defaultShortcut = defaultShortcuts.find((s) => s.id === id)
    if (defaultShortcut) {
      updateShortcut(id, defaultShortcut.defaultKeys)
    }
  }

  const resetAllShortcuts = () => {
    setShortcuts(defaultShortcuts)
    saveShortcuts(defaultShortcuts)
  }

  return {
    shortcuts,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
  }
}


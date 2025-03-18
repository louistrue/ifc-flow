"use client"

import { useEffect, useState } from "react"

export interface AppSettings {
  general: {
    theme: "light" | "dark" | "system"
    autoSave: boolean
    autoSaveInterval: number // in minutes
  }
  viewer: {
    showGrid: boolean
    snapToGrid: boolean
    gridSize: number
  }
  performance: {
    maxNodes: number
    renderQuality: "low" | "medium" | "high"
  }
}

// Default settings
export const defaultSettings: AppSettings = {
  general: {
    theme: "system",
    autoSave: true,
    autoSaveInterval: 5, // 5 minutes
  },
  viewer: {
    showGrid: true,
    snapToGrid: true,
    gridSize: 15,
  },
  performance: {
    maxNodes: 1000,
    renderQuality: "medium",
  },
}

// Load settings from localStorage
export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings

  try {
    const savedSettings = localStorage.getItem("app-settings")
    if (savedSettings) {
      return { ...defaultSettings, ...JSON.parse(savedSettings) }
    }
  } catch (error) {
    console.error("Error loading settings:", error)
  }

  return defaultSettings
}

// Save settings to localStorage
export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem("app-settings", JSON.stringify(settings))
  } catch (error) {
    console.error("Error saving settings:", error)
  }
}

// Hook to use app settings
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    saveSettings(updated)
  }

  const updateGeneralSettings = (generalSettings: Partial<AppSettings["general"]>) => {
    const updated = {
      ...settings,
      general: { ...settings.general, ...generalSettings },
    }
    setSettings(updated)
    saveSettings(updated)
  }

  const updateViewerSettings = (viewerSettings: Partial<AppSettings["viewer"]>) => {
    const updated = {
      ...settings,
      viewer: { ...settings.viewer, ...viewerSettings },
    }
    setSettings(updated)
    saveSettings(updated)
  }

  const updatePerformanceSettings = (performanceSettings: Partial<AppSettings["performance"]>) => {
    const updated = {
      ...settings,
      performance: { ...settings.performance, ...performanceSettings },
    }
    setSettings(updated)
    saveSettings(updated)
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    saveSettings(defaultSettings)
  }

  return {
    settings,
    updateSettings,
    updateGeneralSettings,
    updateViewerSettings,
    updatePerformanceSettings,
    resetSettings,
  }
}


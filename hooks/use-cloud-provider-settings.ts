"use client"

import { useEffect, useState, useCallback, useRef } from "react"

export interface DropboxSettings {
  appKey: string
  accessToken?: string
}

export interface DaluxSettings {
  apiKey: string
  projectId?: string
  baseUrl?: string
}

export interface CloudProviderSettings {
  dropbox?: DropboxSettings
  dalux?: DaluxSettings
}

const STORAGE_KEY = "cloud-provider-settings"

const defaultSettings: CloudProviderSettings = {}

// Load settings from localStorage
function loadCloudSettings(): CloudProviderSettings {
  if (typeof window === "undefined") return defaultSettings

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) }
    }
  } catch (error) {
    console.error("Error loading cloud provider settings:", error)
  }

  return defaultSettings
}

// Save settings to localStorage
function saveCloudSettings(settings: CloudProviderSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Error saving cloud provider settings:", error)
  }
}

/**
 * Hook for managing cloud provider settings.
 *
 * Uses functional state updates to avoid stale closure issues
 * when multiple providers are saved in rapid succession.
 */
export function useCloudProviderSettings() {
  const [settings, setSettings] = useState<CloudProviderSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  // Use a ref to track the latest settings for callbacks that need current values
  const settingsRef = useRef<CloudProviderSettings>(settings)

  // Keep ref in sync with state
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // Load settings from localStorage on mount
  useEffect(() => {
    const loaded = loadCloudSettings()
    setSettings(loaded)
    settingsRef.current = loaded
    setIsLoaded(true)
  }, [])

  /**
   * Update settings using functional state update to avoid stale closure issues.
   * This ensures rapid sequential updates don't overwrite each other.
   */
  const updateSettings = useCallback((newSettings: Partial<CloudProviderSettings>) => {
    setSettings((prevSettings: CloudProviderSettings) => {
      const updated = { ...prevSettings, ...newSettings }
      // Save to localStorage immediately with the merged state
      saveCloudSettings(updated)
      return updated
    })
  }, [])

  /**
   * Update Dropbox settings specifically.
   * Uses functional update to merge with current state, not closure-captured state.
   */
  const updateDropboxSettings = useCallback((dropboxSettings: Partial<DropboxSettings>) => {
    setSettings((prevSettings: CloudProviderSettings) => {
      const updated = {
        ...prevSettings,
        dropbox: { ...prevSettings.dropbox, ...dropboxSettings } as DropboxSettings,
      }
      saveCloudSettings(updated)
      return updated
    })
  }, [])

  /**
   * Update Dalux settings specifically.
   * Uses functional update to merge with current state, not closure-captured state.
   */
  const updateDaluxSettings = useCallback((daluxSettings: Partial<DaluxSettings>) => {
    setSettings((prevSettings: CloudProviderSettings) => {
      const updated = {
        ...prevSettings,
        dalux: { ...prevSettings.dalux, ...daluxSettings } as DaluxSettings,
      }
      saveCloudSettings(updated)
      return updated
    })
  }, [])

  /**
   * Clear all cloud provider settings.
   */
  const clearSettings = useCallback(() => {
    setSettings(defaultSettings)
    saveCloudSettings(defaultSettings)
  }, [])

  /**
   * Clear settings for a specific provider.
   */
  const clearProviderSettings = useCallback((provider: "dropbox" | "dalux") => {
    setSettings((prevSettings: CloudProviderSettings) => {
      const updated = { ...prevSettings }
      delete updated[provider]
      saveCloudSettings(updated)
      return updated
    })
  }, [])

  /**
   * Check if a provider is configured.
   */
  const isProviderConfigured = useCallback((provider: "dropbox" | "dalux"): boolean => {
    const current = settingsRef.current
    if (provider === "dropbox") {
      return Boolean(current.dropbox?.appKey)
    }
    if (provider === "dalux") {
      return Boolean(current.dalux?.apiKey)
    }
    return false
  }, [])

  return {
    settings,
    isLoaded,
    updateSettings,
    updateDropboxSettings,
    updateDaluxSettings,
    clearSettings,
    clearProviderSettings,
    isProviderConfigured,
  }
}

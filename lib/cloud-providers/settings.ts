"use client"

import { useState, useEffect, useCallback } from "react"
import type { CloudProviderConfig, CloudProviderType } from "./types"

const STORAGE_KEY = "cloud-provider-settings"

export interface CloudProviderSettings extends CloudProviderConfig {}

const defaultSettings: CloudProviderSettings = {
  dropbox: undefined,
  dalux: undefined,
  buildagil: undefined,
}

/**
 * Load cloud provider settings from localStorage
 */
export function loadCloudProviderSettings(): CloudProviderSettings {
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

/**
 * Save cloud provider settings to localStorage
 */
export function saveCloudProviderSettings(settings: CloudProviderSettings): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Error saving cloud provider settings:", error)
  }
}

/**
 * Check if a provider has valid configuration
 */
export function hasValidProviderConfig(
  settings: CloudProviderSettings,
  provider: CloudProviderType
): boolean {
  switch (provider) {
    case "dropbox":
      return !!settings.dropbox?.appKey
    case "dalux":
      return !!(
        settings.dalux?.clientId &&
        settings.dalux?.clientSecret
      )
    case "buildagil":
      return !!(
        settings.buildagil?.serverUrl &&
        settings.buildagil?.clientId &&
        settings.buildagil?.clientSecret
      )
    default:
      return false
  }
}

/**
 * Hook to manage cloud provider settings
 */
export function useCloudProviderSettings() {
  const [settings, setSettings] = useState<CloudProviderSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setSettings(loadCloudProviderSettings())
    setIsLoaded(true)
  }, [])

  const updateSettings = useCallback((newSettings: Partial<CloudProviderSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    saveCloudProviderSettings(updated)
  }, [settings])

  const updateDropboxSettings = useCallback((dropboxSettings: CloudProviderSettings["dropbox"]) => {
    updateSettings({ dropbox: dropboxSettings })
  }, [updateSettings])

  const updateDaluxSettings = useCallback((daluxSettings: CloudProviderSettings["dalux"]) => {
    updateSettings({ dalux: daluxSettings })
  }, [updateSettings])

  const updateBuildagilSettings = useCallback((buildagilSettings: CloudProviderSettings["buildagil"]) => {
    updateSettings({ buildagil: buildagilSettings })
  }, [updateSettings])

  const clearSettings = useCallback(() => {
    setSettings(defaultSettings)
    saveCloudProviderSettings(defaultSettings)
  }, [])

  const hasValidConfig = useCallback((provider: CloudProviderType): boolean => {
    return hasValidProviderConfig(settings, provider)
  }, [settings])

  return {
    settings,
    isLoaded,
    updateSettings,
    updateDropboxSettings,
    updateDaluxSettings,
    updateBuildagilSettings,
    clearSettings,
    hasValidConfig,
  }
}

/**
 * Save access token for a provider
 */
export function saveProviderToken(
  provider: 'dalux' | 'buildagil',
  accessToken: string,
  refreshToken?: string
): void {
  const settings = loadCloudProviderSettings()

  if (provider === 'dalux' && settings.dalux) {
    settings.dalux.accessToken = accessToken
    if (refreshToken) {
      settings.dalux.refreshToken = refreshToken
    }
  } else if (provider === 'buildagil' && settings.buildagil) {
    settings.buildagil.accessToken = accessToken
    if (refreshToken) {
      settings.buildagil.refreshToken = refreshToken
    }
  }

  saveCloudProviderSettings(settings)
}

/**
 * Clear access token for a provider
 */
export function clearProviderToken(provider: 'dalux' | 'buildagil'): void {
  const settings = loadCloudProviderSettings()

  if (provider === 'dalux' && settings.dalux) {
    delete settings.dalux.accessToken
    delete settings.dalux.refreshToken
  } else if (provider === 'buildagil' && settings.buildagil) {
    delete settings.buildagil.accessToken
    delete settings.buildagil.refreshToken
  }

  saveCloudProviderSettings(settings)
}

"use client"

import React, { useState, useCallback, useEffect, useRef, ChangeEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCloudProviderSettings } from "@/hooks/use-cloud-provider-settings"
import { CloudFileBrowser, CloudFile } from "./cloud-file-browser"
import { FileUp, Cloud, HardDrive, Settings, Loader2 } from "lucide-react"

// Type declaration for Dropbox chooser SDK
declare global {
  interface Window {
    Dropbox?: {
      choose: (options: {
        success: (files: Array<{ link: string; name: string }>) => void
        cancel: () => void
        linkType: string
        multiselect: boolean
        extensions: string[]
        folderselect: boolean
      }) => void
    }
  }
}

interface ModelSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected: (file: File) => void
  onCloudFileSelected?: (url: string, filename: string) => void
}

export function ModelSourceDialog({
  open,
  onOpenChange,
  onFileSelected,
  onCloudFileSelected,
}: ModelSourceDialogProps) {
  const [activeTab, setActiveTab] = useState("local")
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Cloud provider settings
  const { settings: cloudSettings, isLoaded, updateDropboxSettings, updateDaluxSettings } =
    useCloudProviderSettings()

  // Form state for settings - initialized empty, synced via useEffect
  const [dropboxAppKey, setDropboxAppKey] = useState("")
  const [daluxApiKey, setDaluxApiKey] = useState("")
  const [daluxProjectId, setDaluxProjectId] = useState("")

  // Local file selection
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * FIX: Sync form fields with async-loaded cloud settings.
   * useState doesn't re-initialize when cloudSettings changes, so we use
   * useEffect to update form state when settings are loaded.
   */
  useEffect(() => {
    if (isLoaded) {
      setDropboxAppKey(cloudSettings.dropbox?.appKey || "")
      setDaluxApiKey(cloudSettings.dalux?.apiKey || "")
      setDaluxProjectId(cloudSettings.dalux?.projectId || "")
    }
  }, [isLoaded, cloudSettings])

  const handleLocalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedLocalFile(e.target.files[0])
    }
  }

  const handleLocalFileOpen = () => {
    if (selectedLocalFile) {
      onFileSelected(selectedLocalFile)
      handleReset()
      onOpenChange(false)
    }
  }

  const handleReset = () => {
    setSelectedLocalFile(null)
    setIsLoading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  /**
   * FIX: Dropbox chooser with proper cancel handling.
   * The cancel callback now properly resets the loading state.
   */
  const handleDropboxClick = useCallback(() => {
    if (!cloudSettings.dropbox?.appKey) {
      setShowSettings(true)
      return
    }

    setIsLoading(true)

    if (window.Dropbox) {
      window.Dropbox.choose({
        success: (files) => {
          setIsLoading(false)
          if (files.length > 0 && onCloudFileSelected) {
            onCloudFileSelected(files[0].link, files[0].name)
            onOpenChange(false)
          }
        },
        /**
         * FIX: Cancel callback must reset loading state.
         * Previously this was empty, causing the dialog to be stuck
         * in loading state forever when user cancelled.
         */
        cancel: () => {
          setIsLoading(false)
        },
        linkType: "direct",
        multiselect: false,
        extensions: [".ifc"],
        folderselect: false,
      })
    } else {
      // Dropbox SDK not loaded - reset loading state
      setIsLoading(false)
      console.error("Dropbox SDK not loaded")
    }
  }, [cloudSettings.dropbox?.appKey, onCloudFileSelected, onOpenChange])

  /**
   * Handle cloud file selection from the file browser.
   * Receives the file directly as a parameter to avoid stale state issues.
   */
  const handleCloudFileSelect = useCallback(
    (file: CloudFile) => {
      if (onCloudFileSelected) {
        onCloudFileSelected(file.downloadUrl, file.name)
        onOpenChange(false)
      }
    },
    [onCloudFileSelected, onOpenChange]
  )

  const handleSaveDropboxSettings = () => {
    updateDropboxSettings({ appKey: dropboxAppKey })
  }

  const handleSaveDaluxSettings = () => {
    updateDaluxSettings({
      apiKey: daluxApiKey,
      projectId: daluxProjectId,
    })
  }

  const isDropboxConfigured = Boolean(cloudSettings.dropbox?.appKey)
  const isDaluxConfigured = Boolean(cloudSettings.dalux?.apiKey)

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        onOpenChange(isOpen)
        if (!isOpen) {
          handleReset()
          setShowSettings(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open IFC Model</DialogTitle>
          <DialogDescription>
            Select an IFC file from your computer or cloud storage.
          </DialogDescription>
        </DialogHeader>

        {showSettings ? (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Cloud Provider Settings</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                Back
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dropbox-app-key">Dropbox App Key</Label>
                <Input
                  id="dropbox-app-key"
                  type="text"
                  placeholder="Enter your Dropbox app key"
                  value={dropboxAppKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDropboxAppKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Create an app at{" "}
                  <a
                    href="https://www.dropbox.com/developers/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Dropbox Developers
                  </a>
                </p>
                <Button onClick={handleSaveDropboxSettings} size="sm">
                  Save Dropbox Settings
                </Button>
              </div>

              <div className="border-t pt-4 space-y-2">
                <Label htmlFor="dalux-api-key">Dalux API Key</Label>
                <Input
                  id="dalux-api-key"
                  type="password"
                  placeholder="Enter your Dalux API key"
                  value={daluxApiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDaluxApiKey(e.target.value)}
                />
                <Label htmlFor="dalux-project-id">Dalux Project ID (optional)</Label>
                <Input
                  id="dalux-project-id"
                  type="text"
                  placeholder="Enter default project ID"
                  value={daluxProjectId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDaluxProjectId(e.target.value)}
                />
                <Button onClick={handleSaveDaluxSettings} size="sm">
                  Save Dalux Settings
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="local" className="gap-1">
                  <HardDrive className="h-4 w-4" />
                  Local
                </TabsTrigger>
                <TabsTrigger value="dropbox" className="gap-1">
                  <Cloud className="h-4 w-4" />
                  Dropbox
                </TabsTrigger>
                <TabsTrigger value="dalux" className="gap-1">
                  <Cloud className="h-4 w-4" />
                  Dalux
                </TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="local-file">IFC File</Label>
                  <Input
                    id="local-file"
                    type="file"
                    accept=".ifc"
                    onChange={handleLocalFileChange}
                    ref={fileInputRef}
                  />
                  {selectedLocalFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedLocalFile.name} (
                      {Math.round(selectedLocalFile.size / 1024)} KB)
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="dropbox" className="space-y-4 py-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Waiting for Dropbox picker...
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLoading(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : isDropboxConfigured ? (
                  <div className="space-y-4">
                    <Button onClick={handleDropboxClick} className="w-full gap-2">
                      <Cloud className="h-4 w-4" />
                      Open Dropbox Chooser
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                      Or browse your Dropbox files below:
                    </p>
                    <CloudFileBrowser
                      provider="dropbox"
                      onFileSelect={handleCloudFileSelect}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                      Dropbox is not configured. Please add your app key in settings.
                    </p>
                    <Button variant="outline" onClick={() => setShowSettings(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Dropbox
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="dalux" className="space-y-4 py-4">
                {isDaluxConfigured ? (
                  <CloudFileBrowser
                    provider="dalux"
                    onFileSelect={handleCloudFileSelect}
                  />
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                      Dalux is not configured. Please add your API key in settings.
                    </p>
                    <Button variant="outline" onClick={() => setShowSettings(true)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Dalux
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                {activeTab === "local" && (
                  <Button
                    onClick={handleLocalFileOpen}
                    disabled={!selectedLocalFile}
                    className="gap-1"
                  >
                    <FileUp className="h-4 w-4" />
                    Open
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

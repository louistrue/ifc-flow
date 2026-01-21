"use client"

import { useState, useRef, ChangeEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  FileUp,
  Cloud,
  Building2,
  FolderOpen,
  AlertCircle,
  Loader2,
  Settings,
} from "lucide-react"
import { useCloudProviderSettings } from "@/lib/cloud-providers/settings"
import { openDropboxChooser } from "@/lib/cloud-providers/dropbox"
import { DaluxBrowser } from "./cloud-browsers/dalux-browser"
import { BuildagilBrowser } from "./cloud-browsers/buildagil-browser"
import type { CloudFile, CloudProviderCallbacks } from "@/lib/cloud-providers/types"

interface ModelSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelected: (file: File) => void
  onCloudFileSelected: (cloudFile: CloudFile, data: ArrayBuffer) => void
  onOpenSettings?: () => void
}

export function ModelSourceDialog({
  open,
  onOpenChange,
  onFileSelected,
  onCloudFileSelected,
  onOpenSettings,
}: ModelSourceDialogProps) {
  const [activeTab, setActiveTab] = useState("local")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { settings, hasValidConfig } = useCloudProviderSettings()

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (!file.name.toLowerCase().endsWith('.ifc')) {
        setError('Please select an IFC file')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleLocalOpen = () => {
    if (selectedFile) {
      onFileSelected(selectedFile)
      handleReset()
      onOpenChange(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setError(null)
    setIsLoading(false)
    setLoadingMessage("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const createCloudCallbacks = (): CloudProviderCallbacks => ({
    onFileSelected: (cloudFile, data) => {
      setIsLoading(false)
      setLoadingMessage("")
      onCloudFileSelected(cloudFile, data)
      handleReset()
      onOpenChange(false)
    },
    onError: (err) => {
      setIsLoading(false)
      setLoadingMessage("")
      setError(err.message)
    },
    onProgress: (percentage, message) => {
      setLoadingMessage(`${message} (${Math.round(percentage)}%)`)
    },
  })

  const handleDropboxClick = () => {
    if (!settings.dropbox?.appKey) {
      setError('Dropbox is not configured. Please add your App Key in settings.')
      return
    }
    setError(null)
    setIsLoading(true)
    setLoadingMessage("Opening Dropbox...")
    openDropboxChooser(settings.dropbox.appKey, createCloudCallbacks())
  }

  const handleCloudFileSelected = (cloudFile: CloudFile, data: ArrayBuffer) => {
    onCloudFileSelected(cloudFile, data)
    handleReset()
    onOpenChange(false)
  }

  const renderProviderNotConfigured = (provider: string, configUrl?: string) => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {provider} is not configured yet.
        </p>
        <p className="text-xs text-muted-foreground">
          Add your API credentials in Settings to use this provider.
        </p>
      </div>
      {onOpenSettings && (
        <Button variant="outline" size="sm" onClick={onOpenSettings}>
          <Settings className="h-4 w-4 mr-2" />
          Open Settings
        </Button>
      )}
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) handleReset()
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Load IFC Model</DialogTitle>
          <DialogDescription>
            Select a source to load your IFC model from.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{loadingMessage}</p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="local" className="gap-1.5">
              <FileUp className="h-4 w-4" />
              <span className="hidden sm:inline">Local</span>
            </TabsTrigger>
            <TabsTrigger value="dropbox" className="gap-1.5">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Dropbox</span>
            </TabsTrigger>
            <TabsTrigger value="dalux" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dalux</span>
            </TabsTrigger>
            <TabsTrigger value="buildagil" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Buildagil</span>
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="local" className="mt-0 h-full">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Select IFC File</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file"
                      type="file"
                      accept=".ifc"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="flex-1"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLocalOpen} disabled={!selectedFile}>
                    <FileUp className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dropbox" className="mt-0 h-full">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Browse your Dropbox to select an IFC file.
                </p>

                {hasValidConfig('dropbox') ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Cloud className="h-16 w-16 text-blue-500" />
                    <p className="text-sm text-muted-foreground">
                      Click the button below to open Dropbox file picker
                    </p>
                    <Button onClick={handleDropboxClick} size="lg">
                      <Cloud className="h-4 w-4 mr-2" />
                      Choose from Dropbox
                    </Button>
                  </div>
                ) : (
                  renderProviderNotConfigured('Dropbox')
                )}

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dalux" className="mt-0 h-full">
              {hasValidConfig('dalux') ? (
                <DaluxBrowser
                  config={settings.dalux!}
                  onFileSelected={handleCloudFileSelected}
                  onError={(err) => setError(err.message)}
                  onCancel={() => onOpenChange(false)}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect to Dalux Build to access your BIM models.
                  </p>
                  {renderProviderNotConfigured('Dalux')}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="buildagil" className="mt-0 h-full">
              {hasValidConfig('buildagil') ? (
                <BuildagilBrowser
                  config={settings.buildagil!}
                  onFileSelected={handleCloudFileSelected}
                  onError={(err) => setError(err.message)}
                  onCancel={() => onOpenChange(false)}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect to Buildagil (OpenCDE) to access your documents.
                  </p>
                  {renderProviderNotConfigured('Buildagil')}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

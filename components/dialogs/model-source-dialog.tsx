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
  ExternalLink,
  Check,
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
}

export function ModelSourceDialog({
  open,
  onOpenChange,
  onFileSelected,
  onCloudFileSelected,
}: ModelSourceDialogProps) {
  const [activeTab, setActiveTab] = useState("local")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    settings,
    updateDropboxSettings,
    updateDaluxSettings,
    updateBuildagilSettings,
    hasValidConfig,
  } = useCloudProviderSettings()

  // Local form state for cloud providers
  const [dropboxAppKey, setDropboxAppKey] = useState(settings.dropbox?.appKey || "")
  const [daluxClientId, setDaluxClientId] = useState(settings.dalux?.clientId || "")
  const [daluxClientSecret, setDaluxClientSecret] = useState(settings.dalux?.clientSecret || "")
  const [buildagilServerUrl, setBuildagilServerUrl] = useState(settings.buildagil?.serverUrl || "")
  const [buildagilClientId, setBuildagilClientId] = useState(settings.buildagil?.clientId || "")
  const [buildagilClientSecret, setBuildagilClientSecret] = useState(settings.buildagil?.clientSecret || "")

  // Track if credentials are saved
  const [dropboxSaved, setDropboxSaved] = useState(hasValidConfig('dropbox'))
  const [daluxSaved, setDaluxSaved] = useState(hasValidConfig('dalux'))
  const [buildagilSaved, setBuildagilSaved] = useState(hasValidConfig('buildagil'))

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

  // Save handlers
  const handleSaveDropbox = () => {
    updateDropboxSettings({ appKey: dropboxAppKey.trim() })
    setDropboxSaved(true)
  }

  const handleSaveDalux = () => {
    updateDaluxSettings({
      clientId: daluxClientId.trim(),
      clientSecret: daluxClientSecret.trim(),
      apiUrl: "https://api.dalux.com/build/v1",
    })
    setDaluxSaved(true)
  }

  const handleSaveBuildagil = () => {
    updateBuildagilSettings({
      serverUrl: buildagilServerUrl.trim(),
      clientId: buildagilClientId.trim(),
      clientSecret: buildagilClientSecret.trim(),
    })
    setBuildagilSaved(true)
  }

  const handleDropboxClick = () => {
    if (!settings.dropbox?.appKey) {
      setError('Please save your Dropbox App Key first')
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
            {/* Local File Tab */}
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

            {/* Dropbox Tab */}
            <TabsContent value="dropbox" className="mt-0 h-full">
              <div className="space-y-4">
                {!dropboxSaved || !hasValidConfig('dropbox') ? (
                  // Configuration form
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Cloud className="h-5 w-5" />
                      <span className="font-medium">Connect to Dropbox</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enter your Dropbox App Key to browse and load IFC files.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="dropbox-key">App Key</Label>
                      <Input
                        id="dropbox-key"
                        type="text"
                        placeholder="Enter your Dropbox App Key"
                        value={dropboxAppKey}
                        onChange={(e) => setDropboxAppKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your App Key from the{" "}
                        <a
                          href="https://www.dropbox.com/developers/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          Dropbox Developer Console
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveDropbox} disabled={!dropboxAppKey.trim()}>
                        <Check className="h-4 w-4 mr-2" />
                        Save & Continue
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Dropbox picker
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <Cloud className="h-16 w-16 text-blue-500" />
                      <p className="text-sm text-muted-foreground text-center">
                        Click the button below to open Dropbox and select an IFC file
                      </p>
                      <Button onClick={handleDropboxClick} size="lg">
                        <Cloud className="h-4 w-4 mr-2" />
                        Choose from Dropbox
                      </Button>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setDropboxSaved(false)}
                      >
                        Change App Key
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Dalux Tab */}
            <TabsContent value="dalux" className="mt-0 h-full">
              {!daluxSaved || !hasValidConfig('dalux') ? (
                // Configuration form
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Building2 className="h-5 w-5" />
                    <span className="font-medium">Connect to Dalux Build</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your Dalux API credentials to browse and load IFC models.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="dalux-client-id">Client ID</Label>
                      <Input
                        id="dalux-client-id"
                        type="text"
                        placeholder="Enter your Dalux Client ID"
                        value={daluxClientId}
                        onChange={(e) => setDaluxClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dalux-client-secret">Client Secret</Label>
                      <Input
                        id="dalux-client-secret"
                        type="password"
                        placeholder="Enter your Dalux Client Secret"
                        value={daluxClientSecret}
                        onChange={(e) => setDaluxClientSecret(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Request API credentials from{" "}
                      <a
                        href="https://support.dalux.com/hc/en-us/articles/9544314902556-Dalux-API"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Dalux Support
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveDalux}
                      disabled={!daluxClientId.trim() || !daluxClientSecret.trim()}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save & Continue
                    </Button>
                  </div>
                </div>
              ) : (
                // Dalux browser
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setDaluxSaved(false)}
                    >
                      Change credentials
                    </button>
                  </div>
                  <DaluxBrowser
                    config={settings.dalux!}
                    onFileSelected={handleCloudFileSelected}
                    onError={(err) => setError(err.message)}
                    onCancel={() => onOpenChange(false)}
                  />
                </div>
              )}
            </TabsContent>

            {/* Buildagil Tab */}
            <TabsContent value="buildagil" className="mt-0 h-full">
              {!buildagilSaved || !hasValidConfig('buildagil') ? (
                // Configuration form
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <FolderOpen className="h-5 w-5" />
                    <span className="font-medium">Connect to Buildagil (OpenCDE)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your Buildagil server details and API credentials.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="buildagil-server">Server URL</Label>
                      <Input
                        id="buildagil-server"
                        type="url"
                        placeholder="https://your-server.buildagil.com"
                        value={buildagilServerUrl}
                        onChange={(e) => setBuildagilServerUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buildagil-client-id">Client ID</Label>
                      <Input
                        id="buildagil-client-id"
                        type="text"
                        placeholder="Enter your Client ID"
                        value={buildagilClientId}
                        onChange={(e) => setBuildagilClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buildagil-client-secret">Client Secret</Label>
                      <Input
                        id="buildagil-client-secret"
                        type="password"
                        placeholder="Enter your Client Secret"
                        value={buildagilClientSecret}
                        onChange={(e) => setBuildagilClientSecret(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uses the{" "}
                      <a
                        href="https://github.com/buildingSMART/OpenCDE-API"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        OpenCDE API standard
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveBuildagil}
                      disabled={!buildagilServerUrl.trim() || !buildagilClientId.trim() || !buildagilClientSecret.trim()}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save & Continue
                    </Button>
                  </div>
                </div>
              ) : (
                // Buildagil browser
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setBuildagilSaved(false)}
                    >
                      Change credentials
                    </button>
                  </div>
                  <BuildagilBrowser
                    config={settings.buildagil!}
                    onFileSelected={handleCloudFileSelected}
                    onError={(err) => setError(err.message)}
                    onCancel={() => onOpenChange(false)}
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

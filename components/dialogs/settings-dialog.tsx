"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useAppSettings } from "@/lib/settings-manager"
import { useCloudProviderSettings } from "@/lib/cloud-providers/settings"
import { Monitor, Moon, Sun, Cloud, Building2, FolderOpen, ExternalLink, Check, X } from "lucide-react"

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("general")
  const { settings, updateGeneralSettings, updateViewerSettings, updatePerformanceSettings, resetSettings } =
    useAppSettings()
  const {
    settings: cloudSettings,
    updateDropboxSettings,
    updateDaluxSettings,
    updateBuildagilSettings,
    hasValidConfig,
  } = useCloudProviderSettings()

  // Local state for cloud provider forms
  const [dropboxAppKey, setDropboxAppKey] = useState(cloudSettings.dropbox?.appKey || "")
  const [daluxClientId, setDaluxClientId] = useState(cloudSettings.dalux?.clientId || "")
  const [daluxClientSecret, setDaluxClientSecret] = useState(cloudSettings.dalux?.clientSecret || "")
  const [buildagilServerUrl, setBuildagilServerUrl] = useState(cloudSettings.buildagil?.serverUrl || "")
  const [buildagilClientId, setBuildagilClientId] = useState(cloudSettings.buildagil?.clientId || "")
  const [buildagilClientSecret, setBuildagilClientSecret] = useState(cloudSettings.buildagil?.clientSecret || "")

  const handleSaveDropbox = () => {
    updateDropboxSettings({
      appKey: dropboxAppKey.trim(),
    })
  }

  const handleSaveDalux = () => {
    updateDaluxSettings({
      clientId: daluxClientId.trim(),
      clientSecret: daluxClientSecret.trim(),
      apiUrl: "https://api.dalux.com/build/v1",
    })
  }

  const handleSaveBuildagil = () => {
    updateBuildagilSettings({
      serverUrl: buildagilServerUrl.trim(),
      clientId: buildagilClientId.trim(),
      clientSecret: buildagilClientSecret.trim(),
    })
  }

  const ConfigStatus = ({ isConfigured }: { isConfigured: boolean }) => (
    <span className={`inline-flex items-center gap-1 text-xs ${isConfigured ? 'text-green-600' : 'text-muted-foreground'}`}>
      {isConfigured ? (
        <>
          <Check className="h-3 w-3" />
          Configured
        </>
      ) : (
        <>
          <X className="h-3 w-3" />
          Not configured
        </>
      )}
    </span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure application settings and preferences.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="viewer">Viewer</TabsTrigger>
            <TabsTrigger value="performance">Perf</TabsTrigger>
            <TabsTrigger value="cloud">Cloud</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.general.theme === "light" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateGeneralSettings({ theme: "light" })}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </Button>
                <Button
                  variant={settings.general.theme === "dark" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateGeneralSettings({ theme: "dark" })}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </Button>
                <Button
                  variant={settings.general.theme === "system" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateGeneralSettings({ theme: "system" })}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save">Auto-save</Label>
                <Switch
                  id="auto-save"
                  checked={settings.general.autoSave}
                  onCheckedChange={(checked) => updateGeneralSettings({ autoSave: checked })}
                />
              </div>
              <p className="text-sm text-muted-foreground">Automatically save your workflow at regular intervals.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-save-interval">Auto-save interval (minutes)</Label>
              <div className="flex items-center gap-2">
                <Slider
                  id="auto-save-interval"
                  min={1}
                  max={30}
                  step={1}
                  value={[settings.general.autoSaveInterval]}
                  onValueChange={(value) => updateGeneralSettings({ autoSaveInterval: value[0] })}
                  disabled={!settings.general.autoSave}
                  className="flex-1"
                />
                <span className="w-12 text-center">{settings.general.autoSaveInterval}</span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="viewer" className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid">Show grid</Label>
                <Switch
                  id="show-grid"
                  checked={settings.viewer.showGrid}
                  onCheckedChange={(checked) => updateViewerSettings({ showGrid: checked })}
                />
              </div>
              <p className="text-sm text-muted-foreground">Display a grid in the background of the canvas.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="snap-to-grid">Snap to grid</Label>
                <Switch
                  id="snap-to-grid"
                  checked={settings.viewer.snapToGrid}
                  onCheckedChange={(checked) => updateViewerSettings({ snapToGrid: checked })}
                />
              </div>
              <p className="text-sm text-muted-foreground">Automatically align nodes to the grid when moving them.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grid-size">Grid size</Label>
              <div className="flex items-center gap-2">
                <Slider
                  id="grid-size"
                  min={5}
                  max={50}
                  step={5}
                  value={[settings.viewer.gridSize]}
                  onValueChange={(value) => updateViewerSettings({ gridSize: value[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-center">{settings.viewer.gridSize}px</span>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="performance" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="max-nodes">Maximum nodes</Label>
              <div className="flex items-center gap-2">
                <Slider
                  id="max-nodes"
                  min={100}
                  max={5000}
                  step={100}
                  value={[settings.performance.maxNodes]}
                  onValueChange={(value) => updatePerformanceSettings({ maxNodes: value[0] })}
                  className="flex-1"
                />
                <span className="w-16 text-center">{settings.performance.maxNodes}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum number of nodes allowed in a workflow. Higher values may impact performance.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="render-quality">Render quality</Label>
              <Select
                value={settings.performance.renderQuality}
                onValueChange={(value) =>
                  updatePerformanceSettings({ renderQuality: value as "low" | "medium" | "high" })
                }
              >
                <SelectTrigger id="render-quality">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Higher quality settings may impact performance on complex models.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="cloud" className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Configure cloud storage providers to load IFC models directly from your cloud storage.
            </p>

            {/* Dropbox */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  <Label className="text-base font-medium">Dropbox</Label>
                </div>
                <ConfigStatus isConfigured={hasValidConfig('dropbox')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropbox-app-key" className="text-sm">App Key</Label>
                <Input
                  id="dropbox-app-key"
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
              <Button size="sm" onClick={handleSaveDropbox} disabled={!dropboxAppKey.trim()}>
                Save Dropbox Settings
              </Button>
            </div>

            {/* Dalux */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-500" />
                  <Label className="text-base font-medium">Dalux Build</Label>
                </div>
                <ConfigStatus isConfigured={hasValidConfig('dalux')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dalux-client-id" className="text-sm">Client ID</Label>
                <Input
                  id="dalux-client-id"
                  type="text"
                  placeholder="Enter your Dalux Client ID"
                  value={daluxClientId}
                  onChange={(e) => setDaluxClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dalux-client-secret" className="text-sm">Client Secret</Label>
                <Input
                  id="dalux-client-secret"
                  type="password"
                  placeholder="Enter your Dalux Client Secret"
                  value={daluxClientSecret}
                  onChange={(e) => setDaluxClientSecret(e.target.value)}
                />
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
              <Button
                size="sm"
                onClick={handleSaveDalux}
                disabled={!daluxClientId.trim() || !daluxClientSecret.trim()}
              >
                Save Dalux Settings
              </Button>
            </div>

            {/* Buildagil */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-green-500" />
                  <Label className="text-base font-medium">Buildagil (OpenCDE)</Label>
                </div>
                <ConfigStatus isConfigured={hasValidConfig('buildagil')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildagil-server-url" className="text-sm">Server URL</Label>
                <Input
                  id="buildagil-server-url"
                  type="url"
                  placeholder="https://your-server.buildagil.com"
                  value={buildagilServerUrl}
                  onChange={(e) => setBuildagilServerUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildagil-client-id" className="text-sm">Client ID</Label>
                <Input
                  id="buildagil-client-id"
                  type="text"
                  placeholder="Enter your Client ID"
                  value={buildagilClientId}
                  onChange={(e) => setBuildagilClientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildagil-client-secret" className="text-sm">Client Secret</Label>
                <Input
                  id="buildagil-client-secret"
                  type="password"
                  placeholder="Enter your Client Secret"
                  value={buildagilClientSecret}
                  onChange={(e) => setBuildagilClientSecret(e.target.value)}
                />
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
              <Button
                size="sm"
                onClick={handleSaveBuildagil}
                disabled={!buildagilServerUrl.trim() || !buildagilClientId.trim() || !buildagilClientSecret.trim()}
              >
                Save Buildagil Settings
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={resetSettings}>
            Reset to Defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

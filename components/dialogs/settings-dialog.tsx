"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useAppSettings } from "@/lib/settings-manager"
import { Monitor, Moon, Sun } from "lucide-react"

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("general")
  const { settings, updateGeneralSettings, updateViewerSettings, updatePerformanceSettings, resetSettings } =
    useAppSettings()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure application settings and preferences.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="viewer">Viewer</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
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


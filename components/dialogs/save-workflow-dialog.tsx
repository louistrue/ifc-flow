"use client";

import type React from "react";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Save,
  FileDown,
  TagIcon,
  HelpCircle,
  Upload,
} from "lucide-react";
import { workflowStorage } from "@/lib/workflow-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSave,
  onSaveLocally,
  flowData,
  existingWorkflow,
}) {
  const [name, setName] = useState(existingWorkflow?.name || "");
  const [description, setDescription] = useState(
    existingWorkflow?.description || ""
  );
  const [tags, setTags] = useState<string[]>(existingWorkflow?.tags || []);
  const [newTag, setNewTag] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "local">("library");
  const [localFilename, setLocalFilename] = useState(
    existingWorkflow?.name || "untitled-workflow"
  );

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setName(existingWorkflow?.name || "");
      setDescription(existingWorkflow?.description || "");
      setTags(existingWorkflow?.tags || []);
      setLocalFilename(
        existingWorkflow?.name?.toLowerCase().replace(/\s+/g, "-") ||
          "untitled-workflow"
      );
      setActiveTab("library");
    }
    onOpenChange(open);
  };

  // Add a new tag
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  // Remove a tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Add tag on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle save to library
  const handleSaveToLibrary = () => {
    if (!name.trim()) {
      alert("Please enter a name for your workflow");
      return;
    }

    const id = existingWorkflow?.id || crypto.randomUUID();
    const createdAt = existingWorkflow?.createdAt || new Date().toISOString();
    const thumbnail = workflowStorage.generateThumbnail(flowData);

    const workflow = {
      id,
      name: name.trim(),
      description: description.trim(),
      tags,
      createdAt,
      updatedAt: new Date().toISOString(),
      thumbnail,
      flowData,
    };

    workflowStorage.saveWorkflow(workflow);
    onSave(workflow);
    handleOpenChange(false);
  };

  // Handle local save
  const handleSaveLocally = () => {
    if (!localFilename.trim()) {
      alert("Please enter a filename");
      return;
    }

    const filename = localFilename.trim().endsWith(".json")
      ? localFilename.trim()
      : `${localFilename.trim()}.json`;

    const id = existingWorkflow?.id || crypto.randomUUID();
    const createdAt = existingWorkflow?.createdAt || new Date().toISOString();

    const workflow = {
      id,
      name: existingWorkflow?.name || "Untitled Workflow",
      description: existingWorkflow?.description || "",
      tags: existingWorkflow?.tags || [],
      createdAt,
      updatedAt: new Date().toISOString(),
      flowData,
    };

    // Call onSaveLocally with the workflow object
    onSaveLocally(workflow);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Save Workflow</DialogTitle>
          <DialogDescription>
            Save your workflow to the library or as a local file
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "library" | "local")}
          className="mt-2"
        >
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="library" className="flex items-center gap-1">
              <Save className="h-4 w-4" />
              Save to Library
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-1">
              <FileDown className="h-4 w-4" />
              Save as File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter workflow name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for your workflow"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="tags">Tags</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Tags help you organize and find workflows later
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add tags..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <TagIcon className="h-3 w-3" />
                    {tag}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 -mr-1"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                {tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    No tags added
                  </span>
                )}
              </div>
            </div>
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription className="text-xs flex items-center gap-1.5">
                <Save className="h-3.5 w-3.5 text-primary" />
                Workflows saved to the library are stored in your browser's
                local storage
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="local" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="filename"
                  placeholder="Enter filename"
                  value={localFilename}
                  onChange={(e) => setLocalFilename(e.target.value)}
                  autoFocus
                />
                <span className="text-muted-foreground whitespace-nowrap">
                  .json
                </span>
              </div>
            </div>
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription className="text-xs">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileDown className="h-3.5 w-3.5 text-primary" />
                  The workflow will be downloaded as a JSON file to your device.
                </div>
                <div className="pl-5">
                  You can later import this file back into IFCflow using the
                  workflow library.
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === "library" ? (
            <Button onClick={handleSaveToLibrary} disabled={!name.trim()}>
              Save to Library
            </Button>
          ) : (
            <Button
              onClick={handleSaveLocally}
              disabled={!localFilename.trim()}
            >
              Download File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

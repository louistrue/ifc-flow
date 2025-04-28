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
import { workflowStorage, type Workflow } from "@/lib/workflow-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SaveWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (workflow: Workflow) => void;
  onSaveLocally: (workflow: Workflow) => void;
  flowData: any;
  existingWorkflow?: Workflow | null;
}

export function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSave,
  onSaveLocally,
  flowData,
  existingWorkflow,
}: SaveWorkflowDialogProps) {
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

  // Helper function to remove runtime data from nodes before saving
  const cleanFlowDataForSave = (flowData: any) => {
    if (!flowData || !flowData.nodes || !Array.isArray(flowData.nodes)) {
      return flowData; // Return original if structure is unexpected
    }

    // Define properties to remove from node.data
    const propertiesToRemove = [
      'inputData',
      'results',
      'elements',
      'model',
      'isLoading',
      'progress',
      'error',
      'messageId', // Added from quantityNode processing
      // Add any other large/runtime properties here
    ];

    const cleanedNodes = flowData.nodes.map((node: any) => {
      if (!node.data) {
        return node; // Return node as-is if no data property
      }

      const cleanedData = { ...node.data };
      propertiesToRemove.forEach(prop => {
        delete cleanedData[prop];
      });

      // Special handling for propertyNode results if stored directly on data
      // (ensure results array is cleaned or removed if large)
      if (cleanedData.results && Array.isArray(cleanedData.results)) {
        console.warn(`Node ${node.id} still has 'results' property after initial clean. Removing.`);
        delete cleanedData.results;
      }

      return { ...node, data: cleanedData };
    });

    return { ...flowData, nodes: cleanedNodes };
  };

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
    console.log("handleSaveToLibrary called");
    if (!name.trim()) {
      alert("Please enter a name for your workflow");
      return;
    }

    const id = existingWorkflow?.id || crypto.randomUUID();
    const createdAt = existingWorkflow?.createdAt || new Date().toISOString();
    const thumbnail = workflowStorage.generateThumbnail(flowData);

    // Clean the flow data before saving
    const cleanedFlowData = cleanFlowDataForSave(flowData);

    const workflow = {
      id,
      name: name.trim(),
      description: description.trim(),
      tags,
      createdAt,
      updatedAt: new Date().toISOString(),
      thumbnail,
      flowData: cleanedFlowData,
    };

    try {
      workflowStorage.saveWorkflow(workflow);
      onSave(workflow);
      handleOpenChange(false);
    } catch (error) {
      console.error("Error saving workflow to library:", error);
      // Provide more specific feedback for quota errors
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert("Failed to save workflow: Browser storage quota exceeded. The workflow might still be too large even after cleaning.");
      } else {
        alert("An unexpected error occurred while saving the workflow.");
      }
      // Don't close the dialog on error
    }
  };

  // Handle local save
  const handleSaveLocally = () => {
    console.log("handleSaveLocally called");
    if (!localFilename.trim()) {
      alert("Please enter a filename");
      return;
    }

    const filename = localFilename.trim().endsWith(".json")
      ? localFilename.trim()
      : `${localFilename.trim()}.json`;

    const id = existingWorkflow?.id || crypto.randomUUID();
    const createdAt = existingWorkflow?.createdAt || new Date().toISOString();

    // Use current state for the workflow data being saved locally
    const workflow: Workflow = {
      id,
      name: name.trim() || "Untitled Workflow", // Use current name from state
      description: description.trim(), // Use current description from state
      tags: tags, // Use current tags from state
      createdAt,
      updatedAt: new Date().toISOString(),
      flowData,
      // Note: thumbnail is typically generated for library saves, omitted here
    };

    // Directly trigger the download
    try {
      const jsonString = JSON.stringify(workflow, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Optional: Still call the original callback if parent needs notification,
      // but the primary download action is handled above.
      // console.log("Calling onSaveLocally prop (currently commented out)...");
      // onSaveLocally(workflow);

      handleOpenChange(false); // Close dialog after successful download
    } catch (error) {
      console.error("Failed to save workflow locally:", error);
      alert("Error saving workflow as file. Check console for details.");
      // Don't close dialog on error
    }
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
            <Button
              onClick={() => {
                console.log('"Save to Library" button clicked');
                handleSaveToLibrary();
              }}
              disabled={!name.trim()}
            >
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

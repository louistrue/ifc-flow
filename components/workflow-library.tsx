"use client";

import { useState, useRef, useEffect } from "react";
import type React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tag,
  SearchIcon,
  Trash2,
  Download,
  Calendar,
  Edit,
  Upload,
  FilePlus2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { type Workflow, workflowStorage } from "@/lib/workflow-storage";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface WorkflowLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadWorkflow: (workflow: Workflow) => void;
}

export function WorkflowLibrary({
  open,
  onOpenChange,
  onLoadWorkflow,
}: WorkflowLibraryProps) {
  const [workflows, setWorkflows] = useState(() =>
    workflowStorage.getWorkflows()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("library");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to refresh workflows
  const refreshWorkflows = () => {
    setWorkflows(workflowStorage.getWorkflows());
  };

  // Effect to refresh workflows when the dialog opens
  useEffect(() => {
    if (open) {
      refreshWorkflows();
      // Reset import state if coming from import tab
      setActiveTab("library");
      setImportError("");
      setImportSuccess(false);
    }
  }, [open]);

  // Filter workflows based on search term
  const filteredWorkflows = workflows.filter(
    (workflow) =>
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  // Delete a workflow
  const handleDeleteWorkflow = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      workflowStorage.deleteWorkflow(id);
      refreshWorkflows();
      toast({
        title: "Workflow deleted",
        description: `"${name}" has been removed from your library`,
      });
    }
  };

  // Download a workflow
  const handleDownloadWorkflow = (workflow: Workflow) => {
    workflowStorage.exportWorkflow(workflow);
    toast({
      title: "Workflow downloaded",
      description: `"${workflow.name}" has been downloaded to your device`,
    });
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Trigger file input click
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection for import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError("");
    setImportSuccess(false);

    try {
      const workflow = await workflowStorage.importWorkflow(file);
      refreshWorkflows();
      setImportSuccess(true);
      toast({
        title: "Workflow imported",
        description: `"${workflow.name}" has been imported to your library`,
      });
    } catch (error: unknown) {
      console.error("Error importing workflow:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import workflow file";
      setImportError(errorMessage);
      toast({
        title: "Import failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Workflow Library</DialogTitle>
          <DialogDescription>
            Browse, manage, and load your saved workflows
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="library">My Library</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>

            {activeTab === "library" && (
              <div className="flex gap-2">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workflows..."
                    className="pl-8 w-[250px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={refreshWorkflows}
                >
                  Refresh
                </Button>
              </div>
            )}
          </div>

          <TabsContent
            value="library"
            className="flex-1 overflow-hidden flex flex-col gap-4"
          >
            {workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="bg-muted rounded-full p-3 mb-4">
                  <FilePlus2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No workflows found</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  You don't have any saved workflows yet. Create a workflow and
                  save it to your library, or import existing workflows.
                </p>
                <Button
                  onClick={() => setActiveTab("import")}
                  className="gap-1"
                >
                  <Upload className="h-4 w-4" />
                  Import Workflow
                </Button>
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="bg-muted rounded-full p-3 mb-4">
                  <SearchIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No results found</h3>
                <p className="text-muted-foreground mb-4">
                  No workflows match your search term "{searchTerm}". Try a
                  different search or browse all workflows.
                </p>
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Clear Search
                </Button>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredWorkflows.map((workflow) => (
                    <Card key={workflow.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">
                            {workflow.name}
                          </CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownloadWorkflow(workflow)}
                              title="Download workflow"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() =>
                                handleDeleteWorkflow(workflow.id, workflow.name)
                              }
                              title="Delete workflow"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[40px]">
                          {workflow.description || "No description provided"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center text-xs text-muted-foreground gap-4 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(workflow.updatedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Edit className="h-3.5 w-3.5" />
                            <span>
                              {workflow.flowData?.nodes?.length || 0} nodes
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 min-h-[28px]">
                          {workflow.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs flex items-center gap-1"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button
                          className="w-full"
                          onClick={() => {
                            onLoadWorkflow(workflow);
                            onOpenChange(false);
                          }}
                        >
                          Load Workflow
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="import" className="flex-1 overflow-auto">
            <div className="border rounded-md p-6 text-center flex flex-col items-center">
              <div className="bg-muted rounded-full p-3 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">Import Workflow</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Import an IFCflow workflow file (.json) to add it to your
                library
              </p>

              {importError && (
                <Alert variant="destructive" className="mb-4 mx-auto max-w-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Import Error</AlertTitle>
                  <AlertDescription>{importError}</AlertDescription>
                </Alert>
              )}

              {importSuccess && (
                <Alert className="mb-4 mx-auto max-w-md bg-green-50 text-green-900 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Workflow was imported successfully
                  </AlertDescription>
                </Alert>
              )}

              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                onClick={handleImportClick}
                className="gap-2"
                disabled={isImporting}
              >
                {isImporting ? (
                  "Importing..."
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Select File
                  </>
                )}
              </Button>

              <Separator className="my-8" />

              <div className="text-left max-w-md mx-auto">
                <h4 className="font-medium mb-2">Supported File Format</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Import requires a valid workflow JSON file that was previously
                  exported from IFCflow.
                </p>
                <p className="text-sm text-muted-foreground">
                  The file must contain a complete workflow with valid nodes and
                  edges.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

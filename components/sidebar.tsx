"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileUp,
  Box,
  Filter,
  Move,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  CuboidIcon as Cube,
  Workflow,
  Calculator,
  Edit,
  FileText,
  GitBranch,
  BarChart,
  Download,
  Sliders,
  Search,
  Clock,
  Plus,
  Database,
  WorkflowIcon,
} from "lucide-react";
import {
  type Workflow as WorkflowType,
  workflowStorage,
} from "@/lib/workflow-storage";
import { SaveWorkflowDialog } from "@/components/dialogs/save-workflow-dialog";
import { useToast } from "@/hooks/use-toast";
import { NodeStatusBadge } from "@/components/node-status-badge";

export const nodeCategories = [
  {
    name: "Input",
    nodes: [
      {
        id: "ifcNode",
        label: "IFC File",
        icon: <FileUp className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "parameterNode",
        label: "Parameter",
        icon: <Sliders className="h-4 w-4 mr-2" />,
        status: "working",
      },
    ],
  },
  {
    name: "Geometry",
    nodes: [
      {
        id: "geometryNode",
        label: "Extract Geometry",
        icon: <Box className="h-4 w-4 mr-2" />,
        status: "wip",
      },
      {
        id: "transformNode",
        label: "Transform",
        icon: <Move className="h-4 w-4 mr-2" />,
        status: "wip",
      },
      {
        id: "spatialNode",
        label: "Spatial Query",
        icon: <Layers className="h-4 w-4 mr-2" />,
        status: "wip",
      },
    ],
  },
  {
    name: "Data",
    nodes: [
      {
        id: "filterNode",
        label: "Filter Elements",
        icon: <Filter className="h-4 w-4 mr-2" />,
        status: "new",
      },
      {
        id: "propertyNode",
        label: "Property Editor",
        icon: <Edit className="h-4 w-4 mr-2" />,
        status: "new",
      },
      {
        id: "quantityNode",
        label: "Quantity Takeoff",
        icon: <Calculator className="h-4 w-4 mr-2" />,
        status: "new",
      },
      {
        id: "classificationNode",
        label: "Classification",
        icon: <FileText className="h-4 w-4 mr-2" />,
        status: "new",
      },
      {
        id: "relationshipNode",
        label: "Relationships",
        icon: <GitBranch className="h-4 w-4 mr-2" />,
        status: "wip",
      },
      {
        id: "analysisNode",
        label: "Analysis",
        icon: <BarChart className="h-4 w-4 mr-2" />,
        status: "wip",
      },
    ],
  },
  {
    name: "Output",
    nodes: [
      {
        id: "viewerNode",
        label: "Viewer",
        icon: <Cube className="h-4 w-4 mr-2" />,
        status: "wip",
      },
      {
        id: "watchNode",
        label: "Watch",
        icon: <Database className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "exportNode",
        label: "Export",
        icon: <Download className="h-4 w-4 mr-2" />,
        status: "new",
      },
    ],
  },
];

interface SidebarProps {
  onLoadWorkflow: (workflow: WorkflowType) => void;
  getFlowObject: () => any;
}

export function Sidebar({ onLoadWorkflow, getFlowObject }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [presets, setPresets] = useState<WorkflowType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const { toast } = useToast();

  // Load presets from storage
  useEffect(() => {
    const workflows = workflowStorage.getWorkflows();
    const presetWorkflows = workflows.filter((workflow) =>
      workflow.tags.includes("preset")
    );
    setPresets(presetWorkflows);
  }, []);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  // Filter presets based on search query
  const filteredPresets = presets.filter(
    (preset) =>
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle saving a preset
  const handleSavePreset = (workflow: WorkflowType) => {
    // Make sure it has the preset tag
    if (!workflow.tags.includes("preset")) {
      workflow.tags.push("preset");
    }

    // Save to storage
    workflowStorage.saveWorkflow(workflow);

    // Update the presets list
    setPresets((prev) => {
      const exists = prev.some((p) => p.id === workflow.id);
      if (exists) {
        return prev.map((p) => (p.id === workflow.id ? workflow : p));
      } else {
        return [...prev, workflow];
      }
    });

    toast({
      title: "Preset saved",
      description: `${workflow.name} has been saved to your presets`,
    });
  };

  // Handle saving locally
  const handleSaveLocally = (workflow: WorkflowType) => {
    // Save workflow to local file
    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Preset saved locally",
      description: `${workflow.name} has been saved to your device`,
    });
  };

  // Helper function to get tooltip content for node status
  const getStatusTooltipContent = (status: string): string | null => {
    switch (status) {
      case "wip":
        return "WIP: This node is under active development and may be unstable or change significantly.";
      case "new":
        return "New: This node was recently added and is considered stable, but feedback is welcome.";
      default:
        return null;
    }
  };

  // Helper function to render node items, reused in expanded and collapsed views
  const renderNodeItem = (node: any) => {
    const tooltipContent = getStatusTooltipContent(node.status);

    return (
      <div
        key={node.id}
        className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 cursor-grab bg-background hover:bg-accent"
        draggable
        onDragStart={(event) => onDragStart(event, node.id)}
      >
        <div className="flex items-center">
          {node.icon}
          <span className="text-sm mr-1">{node.label}</span>
        </div>
        {tooltipContent ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div> {/* Extra div to prevent TooltipTrigger interfering with flex layout */}
                  <NodeStatusBadge status={node.status as any} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                <p className="max-w-xs text-xs">{tooltipContent}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <NodeStatusBadge status={node.status as any} />
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={`relative border-r bg-card ${collapsed ? "w-12" : "w-64"
          } transition-all duration-300`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-3 z-10 h-6 w-6 rounded-full border bg-background"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {collapsed ? (
          <div className="flex flex-col items-center py-4 gap-4">
            <WorkflowIcon className="h-6 w-6 text-primary" />
            <Separator />
            {/* Map over categories to create HoverCards */}
            {nodeCategories.map((category) => {
              // Find the icon for the category (use first node's icon or a default)
              const CategoryIcon = category.nodes[0]?.icon.type || Box; // Default to Box if no nodes/icon

              return (
                <HoverCard
                  key={category.name}
                  openDelay={200}
                  open={openCategory === category.name}
                  onOpenChange={(isOpen) => {
                    if (isOpen) {
                      setOpenCategory(category.name);
                    } else {
                      if (openCategory === category.name) {
                        setOpenCategory(null);
                      }
                    }
                  }}
                >
                  <HoverCardTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex items-center justify-center p-0"
                      title={category.name}
                    >
                      {/* Render icon type directly with specific size, no margins */}
                      <CategoryIcon className="h-5 w-5" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="start"
                    className="w-60 p-2"
                    onDragStart={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm leading-none mb-2 px-1">
                        {category.name}
                      </h4>
                      <div className="space-y-1">
                        {/* Render draggable nodes inside the palette */}
                        {category.nodes.map(renderNodeItem)}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center p-4">
              <WorkflowIcon className="h-6 w-6 mr-2 text-primary" />
              <h2 className="text-lg font-semibold">IFCflow</h2>
            </div>
            <Separator />
            <Tabs defaultValue="nodes" className="flex-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="nodes">Nodes</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
              </TabsList>
              <TabsContent value="nodes" className="flex-1">
                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="p-4 space-y-4">
                    {nodeCategories.map((category) => (
                      <div key={category.name} className="space-y-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          {category.name}
                        </h3>
                        <div className="space-y-1">
                          {category.nodes.map((node) => renderNodeItem(node))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="presets">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search presets..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="ml-2"
                      title="Save Current as Preset"
                      onClick={() => setSavePresetDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100vh-180px)]">
                    {filteredPresets.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-muted-foreground mb-2">
                          No presets found
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery
                            ? "Try adjusting your search"
                            : "Save a workflow with the 'preset' tag to see it here"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className="rounded-md border px-3 py-2 cursor-pointer bg-background hover:bg-accent"
                            onClick={() => onLoadWorkflow(preset)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {preset.name}
                              </span>
                            </div>
                            {preset.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {preset.description}
                              </p>
                            )}
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>
                                {new Date(preset.updatedAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <SaveWorkflowDialog
        open={savePresetDialogOpen}
        onOpenChange={setSavePresetDialogOpen}
        onSave={handleSavePreset}
        onSaveLocally={handleSaveLocally}
        flowData={getFlowObject ? getFlowObject() : {}}
        existingWorkflow={{
          id: crypto.randomUUID(),
          name: "",
          description: "",
          tags: ["preset"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flowData: {},
        }}
      />
    </>
  );
}

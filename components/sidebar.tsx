"use client";

import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
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
  Terminal,
  WorkflowIcon,
  X,
  GripVertical,
  Shuffle,
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
        status: "working",
      },
      {
        id: "propertyNode",
        label: "Property Editor",
        icon: <Edit className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "quantityNode",
        label: "Quantity Takeoff",
        icon: <Calculator className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "classificationNode",
        label: "Classification",
        icon: <FileText className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "pythonNode",
        label: "Python",
        icon: <Terminal className="h-4 w-4 mr-2" />,
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
        status: "new",
      },
      {
        id: "dataTransformNode",
        label: "Data Transform",
        icon: <Shuffle className="h-4 w-4 mr-2" />,
        status: "new",
      },
    ],
  },
  {
    name: "Output",
    nodes: [
      {
        id: "viewerNode",
        label: "3D Viewer",
        icon: <Eye className="h-4 w-4 mr-2" />,
        status: "working",
      },
      {
        id: "exportNode",
        label: "Export Data",
        icon: <Download className="h-4 w-4 mr-2" />,
        status: "new",
      },
      {
        id: "watchNode",
        label: "Watch Values",
        icon: <Clock className="h-4 w-4 mr-2" />,
        status: "working",
      },
    ],
  },
];

interface SidebarProps {
  onLoadWorkflow: (workflow: WorkflowType) => void;
  getFlowObject: () => any;
  isMobile?: boolean;
  sidebarOpen?: boolean;
  onCloseSidebar?: () => void;
  // New props for mobile node placement
  onNodeSelect?: (nodeType: string) => void;
  selectedNodeType?: string | null;
  placementMode?: boolean;
}

function getStatusTooltipContent(status: string): string | null {
  switch (status) {
    case "working":
      return "This node is fully implemented and working";
    case "wip":
      return "This node is work in progress - basic functionality available";
    case "new":
      return "This node is newly added - limited functionality";
    default:
      return null;
  }
}

export function Sidebar({
  onLoadWorkflow,
  getFlowObject,
  isMobile = false,
  sidebarOpen = true,
  onCloseSidebar,
  onNodeSelect,
  selectedNodeType,
  placementMode = false
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [presets, setPresets] = useState<WorkflowType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const { toast } = useToast();

  // Mobile swipe gesture handling
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

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

  // Handle getting flow object and opening save dialog
  const handleOpenSaveDialog = useCallback(() => {
    const flowObject = getFlowObject();
    if (!flowObject.nodes || flowObject.nodes.length === 0) {
      toast({
        title: "No workflow to save",
        description: "Please add some nodes to your workflow first",
        variant: "destructive",
      });
      return;
    }
    setSavePresetDialogOpen(true);
  }, [getFlowObject, toast]);

  // Mobile swipe gesture handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobile || !sidebarOpen) return;

    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, [isMobile, sidebarOpen]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || !isMobile) return;

    touchCurrentX.current = e.touches[0].clientX;
    const deltaX = touchCurrentX.current - touchStartX.current;

    // Only allow swiping left (closing) from the edge of the sidebar
    if (deltaX < 0 && touchStartX.current > 50) {
      const sidebar = sidebarRef.current;
      if (sidebar) {
        const translateX = Math.max(deltaX, -320); // Limit to sidebar width
        sidebar.style.transform = `translateX(${translateX}px)`;
      }
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || !isMobile) return;

    const deltaX = touchCurrentX.current - touchStartX.current;
    const sidebar = sidebarRef.current;

    if (sidebar) {
      sidebar.style.transform = '';
    }

    // Close if swiped left more than 100px
    if (deltaX < -100 && onCloseSidebar) {
      onCloseSidebar();
    }

    isDragging.current = false;
  }, [isMobile, onCloseSidebar]);

  // Helper function to render node items, reused in expanded and collapsed views
  const renderNodeItem = (node: any) => {
    const tooltipContent = getStatusTooltipContent(node.status);
    const isSelected = selectedNodeType === node.id;

    const handleNodeInteraction = (event: React.MouseEvent | React.TouchEvent) => {
      if (isMobile && onNodeSelect) {
        event.preventDefault();
        onNodeSelect(node.id);
      }
    };

    return (
      <div
        key={node.id}
        className={`
          ${isMobile
            ? `flex items-center justify-between rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all duration-200 active:scale-[0.98] ${isSelected
              ? 'bg-primary/10 border-primary shadow-lg ring-2 ring-primary/20'
              : 'bg-background hover:bg-accent/50 border-border hover:border-primary/20 hover:shadow-sm'
            }`
            : 'flex items-center justify-between rounded-md border border-dashed px-3 py-2 cursor-grab bg-background hover:bg-accent transition-colors duration-200'
          }
        `}
        draggable={!isMobile}
        onDragStart={!isMobile ? (event) => onDragStart(event, node.id) : undefined}
        onClick={isMobile ? handleNodeInteraction : undefined}
        onTouchEnd={isMobile ? handleNodeInteraction : undefined}
      >
        <div className="flex items-center">
          <div className={`${isMobile ? 'mr-3' : 'mr-2'} ${isSelected ? 'text-primary' : ''}`}>
            {node.icon}
          </div>
          <span className={`font-medium ${isMobile ? 'text-base' : 'text-sm'} ${isSelected ? 'text-primary font-semibold' : ''}`}>
            {node.label}
          </span>
          {isSelected && isMobile && (
            <div className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
              Selected
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tooltipContent ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
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
      </div>
    );
  };

  // Mobile header component
  const MobileHeader = () => (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex items-center">
        <WorkflowIcon className="h-6 w-6 mr-2 text-primary" />
        <h2 className="text-lg font-semibold">IFCflow</h2>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCloseSidebar}
        className="h-8 w-8 rounded-full"
        aria-label="Close sidebar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  // Placement mode banner for mobile
  const PlacementModeBanner = () => (
    placementMode && selectedNodeType && (
      <div className="mx-4 mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse" />
            <span className="text-sm font-medium text-primary">
              Tap on canvas to place node
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNodeSelect?.(selectedNodeType)}
            className="text-primary hover:bg-primary/20 h-7"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  );

  // Desktop collapse toggle
  const DesktopCollapseToggle = () => (
    <Button
      variant="ghost"
      size="icon"
      className="absolute -right-3 top-3 z-10 h-6 w-6 rounded-full border bg-background shadow-md hover:shadow-lg transition-shadow"
      onClick={() => setCollapsed(!collapsed)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <ChevronRight className="h-3 w-3" />
      ) : (
        <ChevronLeft className="h-3 w-3" />
      )}
    </Button>
  );

  // Render mobile sidebar (always full content when open)
  if (isMobile) {
    return (
      <div
        ref={sidebarRef}
        className="w-full h-full flex flex-col bg-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drag indicator */}
        <div className="flex justify-center py-2 border-b">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Mobile header */}
        <MobileHeader />

        {/* Placement mode banner */}
        <PlacementModeBanner />

        {/* Mobile content - always expanded */}
        <div className="flex flex-col flex-1">
          <Tabs defaultValue="nodes" className="flex-1 flex flex-col">
            <div className="px-4 pt-4 pb-2">
              <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 rounded-lg p-1">
                <TabsTrigger
                  value="nodes"
                  className="text-sm font-medium py-2.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  Nodes
                </TabsTrigger>
                <TabsTrigger
                  value="presets"
                  className="text-sm font-medium py-2.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200"
                >
                  Presets
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="nodes" className="flex-1 mt-0 px-0">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-6 p-4">
                  {nodeCategories.map((category) => (
                    <div key={category.name} className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {category.name}
                      </h3>
                      <div className="space-y-2">
                        {category.nodes.map(renderNodeItem)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="presets" className="flex-1 mt-0 px-0">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-4 p-4">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search presets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base rounded-lg border-2 focus:border-primary/50"
                    />
                  </div>

                  {/* Add preset button */}
                  <Button
                    onClick={handleOpenSaveDialog}
                    className="w-full justify-start h-12 text-base rounded-lg shadow-sm"
                    variant="outline"
                  >
                    <Plus className="h-5 w-5 mr-3" />
                    Save Current as Preset
                  </Button>

                  <div className="w-full h-px bg-border" />

                  {/* Presets list */}
                  {filteredPresets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                        <Database className="h-7 w-7 text-muted-foreground/60" />
                      </div>
                      <h4 className="text-lg font-medium mb-2">
                        {searchQuery ? "No presets found" : "No presets saved yet"}
                      </h4>
                      {!searchQuery && (
                        <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto">
                          Create your first workflow and save it as a preset to get started
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="p-4 rounded-xl border-2 bg-card hover:bg-accent/50 cursor-pointer transition-all duration-200 hover:border-primary/20 hover:shadow-sm"
                          onClick={() => {
                            onLoadWorkflow(preset);
                            if (onCloseSidebar) {
                              onCloseSidebar();
                            }
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold truncate text-base mb-1">
                                {preset.name}
                              </h4>
                              {preset.description && (
                                <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                                  {preset.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {preset.tags
                                  .filter((tag) => tag !== "preset")
                                  .map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            </div>
                            <div className="ml-3 p-1 rounded-lg bg-muted/50">
                              <Workflow className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <SaveWorkflowDialog
          open={savePresetDialogOpen}
          onOpenChange={setSavePresetDialogOpen}
          onSave={handleSavePreset}
          onSaveLocally={() => { }} // Empty function as we're only saving to local storage
          flowData={getFlowObject()}
          existingWorkflow={{
            id: Date.now().toString(),
            name: "",
            description: "",
            tags: ["preset"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            flowData: {},
          }}
        />
      </div>
    );
  }

  // Desktop sidebar
  return (
    <div
      className={`relative bg-card h-full transition-all duration-300 border-r ${collapsed ? "w-12" : "w-64"}`}
    >
      {/* Desktop collapse toggle */}
      <DesktopCollapseToggle />

      {collapsed ? (
        // Desktop collapsed view
        <div className="flex flex-col items-center py-4 gap-4">
          <WorkflowIcon className="h-6 w-6 text-primary" />
          <Separator />
          {nodeCategories.map((category) => {
            const CategoryIcon = category.nodes[0]?.icon.type || Box;

            return (
              <HoverCard
                key={category.name}
                openDelay={200}
                open={openCategory === category.name}
                onOpenChange={(isOpen) => {
                  setOpenCategory(isOpen ? category.name : null);
                }}
              >
                <HoverCardTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex items-center justify-center p-0 h-8 w-8"
                    title={category.name}
                  >
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
                      {category.nodes.map(renderNodeItem)}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      ) : (
        // Desktop expanded view
        <div className="flex flex-col h-full">
          <div className="flex items-center p-4">
            <WorkflowIcon className="h-6 w-6 mr-2 text-primary" />
            <h2 className="text-lg font-semibold">IFCflow</h2>
          </div>
          <Separator />

          <Tabs defaultValue="nodes" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nodes">Nodes</TabsTrigger>
              <TabsTrigger value="presets">Presets</TabsTrigger>
            </TabsList>

            <TabsContent value="nodes" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="space-y-4 p-4">
                  {nodeCategories.map((category) => (
                    <div key={category.name} className="space-y-2">
                      <h3 className="font-medium text-muted-foreground text-sm">
                        {category.name}
                      </h3>
                      <div className="space-y-1">
                        {category.nodes.map(renderNodeItem)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="presets" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(100vh-120px)]">
                <div className="space-y-4 p-4">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search presets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Add preset button */}
                  <Button
                    onClick={handleOpenSaveDialog}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Save Current as Preset
                  </Button>

                  <Separator />

                  {/* Presets list */}
                  {filteredPresets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {searchQuery ? "No presets found" : "No presets saved yet"}
                      </p>
                      {!searchQuery && (
                        <p className="text-xs mt-1">
                          Create your first workflow and save it as a preset
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="p-3 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors duration-200"
                          onClick={() => onLoadWorkflow(preset)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium truncate text-sm">
                                {preset.name}
                              </h4>
                              {preset.description && (
                                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                  {preset.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {preset.tags
                                  .filter((tag) => tag !== "preset")
                                  .map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            </div>
                            <Workflow className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <SaveWorkflowDialog
        open={savePresetDialogOpen}
        onOpenChange={setSavePresetDialogOpen}
        onSave={handleSavePreset}
        onSaveLocally={() => { }} // Empty function as we're only saving to local storage
        flowData={getFlowObject()}
        existingWorkflow={{
          id: Date.now().toString(),
          name: "",
          description: "",
          tags: ["preset"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flowData: {},
        }}
      />
    </div>
  );
}

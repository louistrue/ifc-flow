"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  formatKeyCombination,
  useKeyboardShortcuts,
} from "@/lib/keyboard-shortcuts";
import { parseTutorialStep } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Info,
  Keyboard,
  Search,
  ArrowRight,
  Code,
  Layers,
  FileJson,
  Building,
  Copy,
  Check,
  Command,
  Shuffle,
  Terminal,
  BarChart,
  Filter,
  Edit,
  Box,
  Eye,
  Download,
  Calculator,
  GitBranch,
} from "lucide-react";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define Shortcut type locally based on usage
interface Shortcut {
  id: string;
  name: string;
  keys: string;
  category: string;
}

// Define type for the accumulator in reduce
type ShortcutsByCategory = Record<string, Shortcut[]>;

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState("nodes");
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Explicitly type the shortcuts from the hook if possible, otherwise use the local Shortcut type
  const { shortcuts } = useKeyboardShortcuts();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Group shortcuts by category
  const shortcutsByCategory = (
    shortcuts as Shortcut[]
  ).reduce<ShortcutsByCategory>((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {});

  // Filter shortcuts by search query
  const filteredShortcuts = searchQuery
    ? shortcuts.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.keys.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : null;

  // Copy shortcut to clipboard
  const handleCopyShortcut = (id: string, keys: string) => {
    navigator.clipboard.writeText(keys);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset focus when tab changes
  useEffect(() => {
    if (dialogRef.current) {
      const focusableElement = dialogRef.current.querySelector(
        '[tabindex="0"]'
      ) as HTMLElement;
      if (focusableElement) focusableElement.focus();
    }
  }, [activeTab]);

  // Node documentation
  const nodeCategories = [
    {
      name: "Input",
      description: "Nodes for loading and providing data",
      nodes: [
        {
          name: "IFC File",
          icon: <Building className="h-4 w-4" />,
          description: "Load IFC models from files",
          usage: "Drag and drop IFC files or click to browse. Provides building data to downstream nodes.",
          inputs: [],
          outputs: ["IFC Model with elements, properties, and geometry"],
          tips: ["Supports IFC2x3 and IFC4 formats", "Large files may take time to load", "Check element counts in the node preview"]
        },
        {
          name: "Parameter",
          icon: <Code className="h-4 w-4" />,
          description: "Provide static values or user inputs",
          usage: "Set constant values, file paths, or configuration parameters for other nodes.",
          inputs: [],
          outputs: ["Static value (text, number, JSON)"],
          tips: ["Use for configuration values", "Supports JSON for complex data", "Can be used as fallback values"]
        }
      ]
    },
    {
      name: "Data Processing",
      description: "Transform and manipulate IFC data",
      nodes: [
        {
          name: "Data Transform",
          icon: <Shuffle className="h-4 w-4" />,
          description: "Visual, step‑based transformer for any JSON/array coming from your workflow.",
          usage: "Build pipelines (Filter → Map → Group → ToMapping) to reshape analysis results or elements for downstream nodes (especially Property Editor).",
          inputs: [
            "Top handle (data): the primary dataset (e.g., Analysis 'room_assignment' results)",
            "Bottom handle (filter, optional): element list used for 'Restrict to incoming elements' or Join"
          ],
          outputs: [
            "Transformed JSON",
            "Mappings object: { mappings: { [GlobalId]: value }, metadata } (consumed by Property Editor)"
          ],
          presets: [
            {
              name: "Room Assignment → Wall Mappings",
              description: "Turns Analysis results into {mappings} for Property Editor",
              steps: "Flatten(elementSpaceMap) → Map({ GlobalId, spaceName }) → ToMapping(key=GlobalId, value=spaceName)"
            },
            {
              name: "Select only Walls",
              description: "Use Restrict with Walls on bottom input instead of filtering in‑node",
              steps: "Enable Restrict → connect Walls to bottom handle"
            },
            {
              name: "External classification join",
              description: "Merge JSON from Parameter node by GlobalId, then map",
              steps: "Join(A.GlobalId = B.GlobalId, type=left) → Map(...) → ToMapping(...)"
            }
          ],
          concepts: [
            {
              title: "Handles & when to use them",
              items: [
                "Use ONLY the top handle in most cases (connect your data here).",
                "The bottom handle appears only when needed (Join step or 'Restrict to incoming elements').",
                "You do not need both inputs unless you are joining or restricting to a specific element set."
              ]
            },
            {
              title: "Pipeline model",
              items: [
                "Steps run top → bottom; the output of one step is the input of the next.",
                "Filter/Unique/Sort/Limit work on arrays; Pick/Omit/Map can handle arrays or objects.",
                "Flatten(path) lets you drill into nested arrays before mapping or grouping."
              ]
            },
            {
              title: "Value mappings (for Property Editor)",
              items: [
                "Use the ToMapping step to produce {mappings: {GlobalId: value}}.",
                "keyPath should resolve to a GlobalId (e.g., 'GlobalId' or 'properties.GlobalId').",
                "valuePath is the value you want to assign (e.g., 'spaceName', 'propertyInfo.value').",
                "In Property Editor: Action=Set, turn on 'Use value from input'."
              ]
            },
            {
              title: "Restrict to incoming elements",
              items: [
                "When enabled, the bottom input defines the allowed element set.",
                "Element IDs are detected from 'GlobalId', 'properties.GlobalId', or 'id'.",
                "Great for applying room names only to walls: connect a Walls list to the bottom handle."
              ]
            },
            {
              title: "Joins",
              items: [
                "Add a Join step to merge top (A) and bottom (B) inputs on a key (e.g., GlobalId).",
                "Choose 'left' to keep all A items; 'inner' to keep only matches.",
                "Use Map afterward to build the fields you need."
              ]
            },
            {
              title: "Troubleshooting",
              items: [
                "Got empty mappings? Remove in‑node Filter or use 'Restrict to incoming elements' instead.",
                "Check 'Sample mappings' on the node — it should show > 0 entries before Property Editor can set values.",
                "Ensure keyPath resolves to a GlobalId and valuePath is not empty or 'None'."
              ]
            }
          ],
          reference: {
            steps: [
              { type: "Filter", purpose: "Keep items matching a condition", config: "path, operator, value" },
              { type: "Map", purpose: "Transform each item", config: "expression or field mapping" },
              { type: "Pick", purpose: "Keep only specific fields", config: "paths[]" },
              { type: "Omit", purpose: "Remove specific fields", config: "paths[]" },
              { type: "Flatten", purpose: "Expand nested arrays at path", config: "path" },
              { type: "GroupBy", purpose: "Group items and aggregate counts", config: "keyPath" },
              { type: "Unique", purpose: "Remove duplicates", config: "keyPath (optional)" },
              { type: "Sort", purpose: "Sort items", config: "path, direction" },
              { type: "Limit", purpose: "Limit result size", config: "count" },
              { type: "Join", purpose: "Merge top and bottom inputs", config: "leftKey, rightKey, type" },
              { type: "Rename", purpose: "Rename fields", config: "from → to[]" },
              { type: "ToMapping", purpose: "Create {mappings} for Property Editor", config: "keyPath, valuePath" }
            ]
          },
          pathHints: {
            keyPaths: ["GlobalId", "properties.GlobalId", "id"],
            valuePaths: ["spaceName", "Name", "properties.IsExternal", "psets.Pset_WallCommon.IsExternal"],
            notes: [
              "Key must uniquely identify elements to apply properties.",
              "If your data is nested, use Flatten before ToMapping.",
              "For Analysis results, 'elementSpaceMap' → Map/ToMapping is typical."
            ]
          },
          tips: [
            "Start with the 'Room Assignment → Wall Mappings' preset",
            "Wire data to the top handle; use the bottom handle only for Restrict/Join",
            "For Property Editor, end with a ToMapping step",
            "Limit targets by enabling 'Restrict to incoming elements' and connecting the element list to the bottom handle",
            "Validate with the node preview; input/output counts should be > 0",
            "If mappings are empty, remove Filter steps or use Restrict instead"
          ],
          examples: [
            {
              title: "Room Assignment to Walls",
              steps: "Analysis (room_assignment) → Data Transform (ToMapping: GlobalId → spaceName) → Property Node",
              description: "Assigns room names to walls based on spatial analysis"
            },
            {
              title: "Restrict mapping to Walls (no Filter step)",
              steps: "Analysis → Data Transform (ToMapping) + Walls (bottom input, Restrict enabled) → Property Node",
              description: "Use the bottom handle only to limit which elements receive values"
            },
            {
              title: "Element Filtering & Grouping",
              steps: "IFC → Data Transform (Filter: type in [IfcWall] → GroupBy: type) → Watch",
              description: "Filter walls and group by type with counts"
            },
            {
              title: "Join external classifications (CSV via Parameter)",
              steps: "IFC → Data Transform (top) + Parameter(JSON) → Data Transform (join on GlobalId → Map fields) → Property Node",
              description: "Merge external datasets and assign codes per element"
            },
            {
              title: "Create GlobalId index",
              steps: "IFC → Data Transform (Map { id: properties.GlobalId, type } → ToMapping key=properties.GlobalId value=type)",
              description: "Produce a quick lookup map of elements by GlobalId"
            }
          ]
        },
        {
          name: "Python",
          icon: <Terminal className="h-4 w-4" />,
          description: "Execute custom Python code with IfcOpenShell",
          usage: "Write Python scripts for complex analysis. Access 'ifc_file', 'input_data', and 'properties' variables.",
          inputs: ["IFC Model (available as 'ifc_file')", "Input data (available as 'input_data')"],
          outputs: ["Result of the 'result' variable"],
          tips: [
            "Use 'ifc_file' to access the IFC model with IfcOpenShell",
            "Access input from previous nodes via 'input_data'",
            "Set 'result' variable to return data to next nodes",
            "Import libraries: ifcopenshell, json, numpy available",
            "Use print() for debugging - output appears in console"
          ],
          examples: [
            {
              title: "Custom Property Analysis",
              code: `# Access the IFC model
walls = ifc_file.by_type('IfcWall')
result = []

for wall in walls:
    props = ifcopenshell.util.element.get_psets(wall)
    result.append({
        'GlobalId': wall.GlobalId,
        'Name': wall.Name,
        'IsExternal': props.get('Pset_WallCommon', {}).get('IsExternal', False)
    })`,
              description: "Extract wall properties into a custom format"
            },
            {
              title: "Room Assignment Transform",
              code: `# Transform room assignment to property mappings
if input_data and 'elementSpaceMap' in input_data:
    mappings = {}
    for global_id, space_info in input_data['elementSpaceMap'].items():
        space_name = space_info.get('spaceName', '')
        if space_name:
            mappings[global_id] = space_name
    
    result = {'mappings': mappings}`,
              description: "Convert analysis results to property mappings"
            }
          ]
        },
        {
          name: "Filter Elements",
          icon: <Filter className="h-4 w-4" />,
          description: "Filter elements by properties or types",
          usage: "Select specific elements based on IFC type, properties, or custom conditions.",
          inputs: ["IFC elements"],
          outputs: ["Filtered elements"],
          tips: ["Use for isolating specific element types", "Combine multiple conditions", "Chain with other processing nodes"]
        },
        {
          name: "Property Editor",
          icon: <Edit className="h-4 w-4" />,
          description: "Get, set, or modify element properties",
          usage: "Read existing properties or assign new values. Connect mappings to 'valueInput' for bulk updates.",
          inputs: ["IFC elements", "Optional: Value mappings (top handle)"],
          outputs: ["Elements with updated properties"],
          tips: [
            "Use 'Set' action with mappings from Data Transform",
            "Specify target Pset (e.g., Pset_WallCommon) or use CustomProperties",
            "Enable 'Use value from input' for mapping-based updates",
            "Property format: 'PropertyName' or 'Pset_Name:PropertyName'"
          ]
        }
      ]
    },
    {
      name: "Analysis",
      description: "Analyze and extract insights from IFC data",
      nodes: [
        {
          name: "Analysis",
          icon: <BarChart className="h-4 w-4" />,
          description: "Spatial analysis and room assignments",
          usage: "Analyze spaces, room assignments, circulation, and occupancy metrics.",
          inputs: ["IFC Model"],
          outputs: ["Analysis results with elementSpaceMap, metrics"],
          tips: [
            "Use 'room_assignment' metric for space-to-element mapping",
            "Results include elementSpaceMap for Data Transform",
            "space_metrics provides area, volume, occupancy calculations",
            "circulation analysis identifies circulation vs program spaces"
          ]
        },
        {
          name: "Quantity Takeoff",
          icon: <Calculator className="h-4 w-4" />,
          description: "Extract quantities and measurements",
          usage: "Calculate areas, volumes, lengths, and other quantities from IFC elements.",
          inputs: ["IFC elements"],
          outputs: ["Quantity data and totals"],
          tips: ["Group by element type or property", "Supports custom quantity calculations", "Export results to CSV/Excel"]
        }
      ]
    },
    {
      name: "Output",
      description: "Export and visualize results",
      nodes: [
        {
          name: "3D Viewer",
          icon: <Eye className="h-4 w-4" />,
          description: "Visualize IFC geometry in 3D",
          usage: "Display filtered elements, highlight analysis results, or preview modifications.",
          inputs: ["IFC elements with geometry"],
          outputs: ["Visual display"],
          tips: ["Use after filtering to focus on specific elements", "Supports property-based coloring", "Navigate with mouse controls"]
        },
        {
          name: "Export Data",
          icon: <Download className="h-4 w-4" />,
          description: "Export processed data or modified IFC files",
          usage: "Save results as IFC, JSON, CSV, or other formats.",
          inputs: ["Processed data or IFC elements"],
          outputs: ["Downloaded file"],
          tips: ["IFC export preserves modifications", "JSON for data analysis", "CSV for spreadsheet compatibility"]
        }
      ]
    }
  ];

  // Filter nodes by search query (moved after nodeCategories definition)
  const filteredNodeCategories = nodeSearchQuery
    ? nodeCategories.map(category => ({
      ...category,
      nodes: category.nodes.filter(node =>
        node.name.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
        node.usage.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
        node.tips.some(tip => tip.toLowerCase().includes(nodeSearchQuery.toLowerCase())) ||
        (node as any).examples?.some((example: any) =>
          example.title.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
          example.description.toLowerCase().includes(nodeSearchQuery.toLowerCase())
        )
      )
    })).filter(category => category.nodes.length > 0)
    : nodeCategories;

  // Tutorial steps
  const tutorialSteps = [
    {
      id: "loading",
      title: "Loading an IFC File",
      icon: <Building className="h-5 w-5" />,
      description: "Start by loading an IFC model to work with.",
      steps: [
        'Click the "Open File" button in the top menu or use <kbd>Ctrl+O</kbd>',
        "Select an IFC file from your device",
        "Alternatively, drag and drop an IFC file directly onto the canvas",
      ],
    },
    {
      id: "workflow",
      title: "Creating a Workflow",
      icon: <Layers className="h-5 w-5" />,
      description:
        "Build your workflow by connecting nodes to process IFC data.",
      steps: [
        "Drag nodes from the sidebar onto the canvas",
        "Connect nodes by clicking and dragging from an output handle to an input handle",
        "Configure node properties by selecting a node and using the properties panel",
        'Run the workflow by clicking the "Run" button or pressing <kbd>F5</kbd>',
      ],
    },
    {
      id: "saving",
      title: "Saving and Loading Workflows",
      icon: <FileJson className="h-5 w-5" />,
      description: "Save your work for later use or sharing.",
      steps: [
        'Save your workflow to the library by clicking "Save to Library" in the File menu or using <kbd>Ctrl+S</kbd>',
        'Download your workflow as a JSON file using "Save Locally" or <kbd>Ctrl+Shift+S</kbd>',
        "Load a saved workflow from the workflow library using <kbd>Ctrl+L</kbd>",
      ],
    },
    {
      id: "navigating",
      title: "Navigating the Canvas",
      icon: <Command className="h-5 w-5" />,
      description: "Move around and organize your workflow.",
      steps: [
        "Zoom in and out using the mouse wheel or <kbd>Ctrl+=</kbd> and <kbd>Ctrl+-</kbd>",
        "Pan by holding the middle mouse button or Space+drag",
        "Select multiple nodes by holding Shift while clicking or dragging a selection box",
        "Fit all nodes in view with <kbd>Ctrl+0</kbd>",
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-background"
      >
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Info className="h-5 w-5 text-primary" />
            IFCflow Help
          </DialogTitle>
          <DialogDescription>
            Documentation and resources to help you use IFCflow
            effectively
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 overflow-hidden flex flex-col mt-2"
        >
          <div className="flex justify-between items-center">
            <TabsList className="mb-2">
              <TabsTrigger
                value="nodes"
                data-tab="nodes"
                className="flex items-center gap-1"
              >
                <Layers className="h-4 w-4" />
                Nodes
              </TabsTrigger>
              <TabsTrigger
                value="shortcuts"
                data-tab="shortcuts"
                className="flex items-center gap-1"
              >
                <Keyboard className="h-4 w-4" />
                Keyboard Shortcuts
              </TabsTrigger>
              <TabsTrigger
                value="tutorial"
                data-tab="tutorial"
                className="flex items-center gap-1"
              >
                <AlertCircle className="h-4 w-4" />
                Tutorial
              </TabsTrigger>
            </TabsList>

            {(activeTab === "shortcuts" || activeTab === "nodes") && (
              <div className="flex gap-2">
                <div className="relative w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={activeTab === "shortcuts" ? "Search shortcuts..." : "Search nodes..."}
                    className="pl-8"
                    value={activeTab === "shortcuts" ? searchQuery : nodeSearchQuery}
                    onChange={(e) => activeTab === "shortcuts"
                      ? setSearchQuery(e.target.value)
                      : setNodeSearchQuery(e.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <TabsContent
            value="nodes"
            className="flex-1 overflow-auto mt-0 border rounded-md p-4"
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  {nodeSearchQuery ? `Search Results for "${nodeSearchQuery}"` : "Node Reference"}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {nodeSearchQuery
                    ? `Found ${filteredNodeCategories.reduce((total, cat) => total + cat.nodes.length, 0)} matching nodes`
                    : "Complete guide to all available nodes and their usage patterns."
                  }
                </p>
              </div>

              {nodeSearchQuery && filteredNodeCategories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No nodes found matching "{nodeSearchQuery}"</p>
                  <p className="text-sm">Try different keywords or clear the search</p>
                </div>
              )}

              {filteredNodeCategories.map((category) => (
                <div key={category.name} className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-primary">{category.name}</h4>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>

                  <div className="grid gap-4">
                    {category.nodes.map((node) => (
                      <div key={node.name} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-md">
                            {node.icon}
                          </div>
                          <div className="flex-1">
                            <h5 className="font-medium">{node.name}</h5>
                            <p className="text-sm text-muted-foreground">{node.description}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Usage: </span>
                            <span className="text-sm">{node.usage}</span>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <span className="text-sm font-medium text-green-600">Inputs:</span>
                              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                                {node.inputs.length > 0 ? (
                                  node.inputs.map((input, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      {input}
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-muted-foreground italic">None</li>
                                )}
                              </ul>
                            </div>

                            <div>
                              <span className="text-sm font-medium text-blue-600">Outputs:</span>
                              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                                {node.outputs.map((output, i) => (
                                  <li key={i} className="flex items-start gap-1">
                                    <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    {output}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div>
                            <span className="text-sm font-medium text-amber-600">Tips:</span>
                            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                              {node.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {(node as any).concepts && (
                            <div>
                              <span className="text-sm font-medium text-primary">Key concepts:</span>
                              <div className="mt-2 space-y-2">
                                {(node as any).concepts.map((c: any, i: number) => (
                                  <div key={i} className="bg-muted/40 rounded p-2">
                                    <div className="text-xs font-medium">{c.title}</div>
                                    <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4 space-y-1">
                                      {c.items.map((it: string, idx: number) => (
                                        <li key={idx}>{it}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(node as any).presets && (
                            <div>
                              <span className="text-sm font-medium text-green-700">Presets:</span>
                              <div className="mt-2 space-y-2">
                                {(node as any).presets.map((p: any, i: number) => (
                                  <div key={i} className="border rounded p-2">
                                    <div className="text-xs font-medium">{p.name}</div>
                                    <div className="text-xs text-muted-foreground">{p.description}</div>
                                    {p.steps && (
                                      <div className="text-xs font-mono bg-background rounded px-2 py-1 mt-2">{p.steps}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(node as any).pathHints && (
                            <div>
                              <span className="text-sm font-medium text-blue-700">Path hints:</span>
                              <div className="grid md:grid-cols-2 gap-3 mt-2">
                                <div>
                                  <div className="text-xs font-medium">Common keyPaths</div>
                                  <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1">
                                    {(node as any).pathHints.keyPaths.map((p: string, i: number) => (
                                      <li key={i}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="text-xs font-medium">Common valuePaths</div>
                                  <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1">
                                    {(node as any).pathHints.valuePaths.map((p: string, i: number) => (
                                      <li key={i}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              {(node as any).pathHints.notes?.length > 0 && (
                                <ul className="text-xs text-muted-foreground list-disc pl-4 mt-2">
                                  {(node as any).pathHints.notes.map((n: string, i: number) => (
                                    <li key={i}>{n}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {(node as any).reference?.steps && (
                            <div>
                              <span className="text-sm font-medium text-purple-700">Step reference:</span>
                              <div className="mt-2 overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="pr-3 py-1">Step</th>
                                      <th className="pr-3 py-1">What it does</th>
                                      <th className="py-1">Common config</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(node as any).reference.steps.map((s: any, i: number) => (
                                      <tr key={i} className="border-t">
                                        <td className="pr-3 py-1 whitespace-nowrap">{s.type}</td>
                                        <td className="pr-3 py-1">{s.purpose}</td>
                                        <td className="py-1 text-muted-foreground">{s.config}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {(node as any).examples && (
                            <div>
                              <span className="text-sm font-medium text-purple-600">Examples:</span>
                              <div className="mt-2 space-y-3">
                                {(node as any).examples.map((example: any, i: number) => (
                                  <div key={i} className="bg-muted/50 rounded-md p-3">
                                    <div className="font-medium text-sm">{example.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{example.description}</div>
                                    {example.steps && (
                                      <div className="text-xs font-mono bg-background rounded px-2 py-1 mt-2">
                                        {example.steps}
                                      </div>
                                    )}
                                    {example.code && (
                                      <pre className="text-xs bg-background rounded p-2 mt-2 overflow-x-auto">
                                        <code>{example.code}</code>
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent
            value="shortcuts"
            className="flex-1 overflow-hidden flex flex-col mt-0 border rounded-md"
            tabIndex={0}
          >


            <ScrollArea className="flex-1 p-4 overflow-y-auto">
              {filteredShortcuts ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Search Results</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Shortcut</TableHead>
                        <TableHead className="w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShortcuts.map((shortcut) => (
                        <TableRow key={shortcut.id}>
                          <TableCell className="capitalize">
                            {shortcut.category}
                          </TableCell>
                          <TableCell>{shortcut.name}</TableCell>
                          <TableCell className="font-mono">
                            {formatKeyCombination(shortcut.keys)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  handleCopyShortcut(shortcut.id, shortcut.keys)
                                }
                                title="Copy shortcut"
                              >
                                {copiedId === shortcut.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                Object.entries(shortcutsByCategory).map(
                  ([category, categoryShortcuts]) => (
                    <div key={category} className="mb-8">
                      <h4 className="text-lg font-medium capitalize mb-3 flex items-center gap-2">
                        {category === "file" && (
                          <FileJson className="h-5 w-5 text-primary" />
                        )}
                        {category === "edit" && (
                          <Code className="h-5 w-5 text-primary" />
                        )}
                        {category === "view" && (
                          <Layers className="h-5 w-5 text-primary" />
                        )}
                        {category === "workflow" && (
                          <Building className="h-5 w-5 text-primary" />
                        )}
                        {category === "help" && (
                          <AlertCircle className="h-5 w-5 text-primary" />
                        )}
                        {category}
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Shortcut</TableHead>
                            <TableHead className="w-[140px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(categoryShortcuts as Shortcut[]).map(
                            (shortcut: Shortcut) => (
                              <TableRow key={shortcut.id}>
                                <TableCell>{shortcut.name}</TableCell>
                                <TableCell>
                                  <span className="font-mono">
                                    {formatKeyCombination(shortcut.keys)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        handleCopyShortcut(
                                          shortcut.id,
                                          shortcut.keys
                                        )
                                      }
                                      title="Copy shortcut"
                                    >
                                      {copiedId === shortcut.id ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )
                )
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="tutorial"
            className="flex-1 overflow-auto mt-0 border rounded-md p-4"
          >
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  Getting Started with IFCflow
                </h3>
                <p className="text-muted-foreground mt-1">
                  Follow this step-by-step guide to learn how to use IFCflow
                  effectively.
                </p>
              </div>

              <Accordion type="single" collapsible className="mt-4 w-full">
                {tutorialSteps.map((section, index) => (
                  <AccordionItem
                    key={section.id}
                    value={section.id}
                    className="border rounded-md mb-2"
                  >
                    <AccordionTrigger className="px-4 py-2 text-left text-lg">
                      <Badge variant="outline" className="mr-2 bg-primary/10">
                        {index + 1}
                      </Badge>
                      <span className="flex items-center gap-2">
                        {section.icon}
                        {section.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="text-muted-foreground mb-2">
                        {section.description}
                      </p>
                      <ol className="space-y-2 ml-6 list-decimal">
                        {section.steps.map((step, i) => (
                          <li key={i}>{parseTutorialStep(step)}</li>
                        ))}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                <h4 className="text-lg font-medium flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Pro Tips
                </h4>
                <ul className="mt-2 space-y-2">
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Use keyboard shortcuts to speed up your workflow. View
                      them in the Shortcuts tab or press <kbd>Shift+F1</kbd>.
                    </span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Save your work regularly using <kbd>Ctrl+S</kbd> to avoid
                      losing progress.
                    </span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>
                      Organize your nodes by grouping related functionality
                      together for better readability.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

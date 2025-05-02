"use client";

import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import {
  Building,
  Building2,
  HomeIcon,
  TreeDeciduous,
  Layers,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { nodeStyle } from "@/lib/node-styles";
import type { IfcElement, IfcModel } from "@/lib/ifc-utils";

interface SpatialTreeNode {
  id: string;
  name: string;
  type: string;
  children: SpatialTreeNode[];
  containedElements?: number;
}

interface EnhancedIfcElement extends IfcElement {
  containedIn?: string;
  containmentStructure?: {
    building?: {
      id: string;
      name?: string;
    } | null;
    storey?: {
      id: string;
      name?: string;
      elevation?: number;
    } | null;
    space?: {
      id: string;
      name?: string;
    } | null;
  };
  isSpatial?: boolean;
  spatialLevel?: number;
  spatialChildren?: string[];
}

interface SpatialHierarchyNodeProps {
  data: {
    label?: string;
    inputData?: {
      elements?: IfcElement[];
    };
    properties?: {
      spatialType?: string;
      ifcproject?: string;
      ifcsite?: string;
      ifcbuilding?: string;
      ifcbuildingstorey?: string;
      ifcspace?: string;
      elementType?: string;
      [key: string]: any;
    };
    updateNodeData?: (data: any) => void;
    error?: string;
  };
  selected?: boolean;
  isConnectable?: boolean;
}

export const SpatialHierarchyNode = memo(
  ({ data, selected, isConnectable }: SpatialHierarchyNodeProps) => {
    const [spatialElements, setSpatialElements] = useState<IfcElement[]>([]);
    const [elementsByType, setElementsByType] = useState<
      Record<string, IfcElement[]>
    >({
      IFCPROJECT: [],
      IFCSITE: [],
      IFCBUILDING: [],
      IFCBUILDINGSTOREY: [],
      IFCSPACE: [],
    });

    useEffect(() => {
      // If input data is available, update the spatial elements
      if (data.inputData && Array.isArray(data.inputData.elements)) {
        const elements = data.inputData.elements as EnhancedIfcElement[];
        console.log(
          "SpatialHierarchyNode: Analyzing elements:",
          elements.length
        );

        // Process the spatial structure here instead of expecting it to be pre-processed
        processSpatialStructure(elements);
      }
    }, [data.inputData]);

    // Add the spatial structure processing function
    const processSpatialStructure = (elements: EnhancedIfcElement[]) => {
      // First check for proper spatial structure
      const spatialTypes = [
        "IFCPROJECT",
        "IFCSITE",
        "IFCBUILDING",
        "IFCBUILDINGSTOREY",
        "IFCSPACE",
      ];

      // Filter for spatial structure elements
      const spatial = elements.filter((el) =>
        spatialTypes.includes(el.type.toUpperCase())
      );

      console.log(
        "SpatialHierarchyNode: Found spatial elements:",
        spatial.length
      );

      // Mark spatial elements
      spatial.forEach((element) => {
        element.isSpatial = true;

        // Set the spatial level based on element type
        switch (element.type.toUpperCase()) {
          case "IFCPROJECT":
            element.spatialLevel = 0;
            break;
          case "IFCSITE":
            element.spatialLevel = 1;
            break;
          case "IFCBUILDING":
            element.spatialLevel = 2;
            break;
          case "IFCBUILDINGSTOREY":
            element.spatialLevel = 3;
            break;
          case "IFCSPACE":
            element.spatialLevel = 4;
            break;
        }
      });

      // Analyze if elements already have proper containment relationships
      let hasExistingSpatialStructure = false;

      // Check if we have any elements with spatialChildren set
      const spatialElementsWithChildren = spatial.filter(
        (el) => el.spatialChildren && el.spatialChildren.length > 0
      );

      if (spatialElementsWithChildren.length > 0) {
        console.log(
          "SpatialHierarchyNode: Found spatial structure hierarchy with containing elements:",
          spatialElementsWithChildren.length
        );
        hasExistingSpatialStructure = true;
      }

      // Check for containment references if no spatial structure exists
      if (!hasExistingSpatialStructure) {
        console.log(
          "SpatialHierarchyNode: No spatial hierarchy found, analyzing elements for container information..."
        );

        // Check if elements have container references
        const elementsWithContainers = elements.filter(
          (el) =>
            el.containedIn ||
            (el.containmentStructure &&
              (el.containmentStructure.building ||
                el.containmentStructure.storey ||
                el.containmentStructure.space))
        );

        if (elementsWithContainers.length > 0) {
          console.log(
            "SpatialHierarchyNode: Found elements with container references:",
            elementsWithContainers.length
          );

          // Try to create a spatial structure from containment references
          createSpatialHierarchyFromContainment(
            elements,
            elementsWithContainers
          );
          hasExistingSpatialStructure = true;
        }
      }

      // If still no spatial structure, create a virtual one
      if (!hasExistingSpatialStructure) {
        console.log(
          "SpatialHierarchyNode: No spatial information found, creating virtual hierarchy"
        );
        createVirtualSpatialHierarchy(elements);
      }

      // Group elements by type for all element types
      const grouped = elements.reduce<Record<string, EnhancedIfcElement[]>>(
        (acc, el) => {
          const type = el.type.toUpperCase();
          if (!acc[type]) acc[type] = [];
          acc[type].push(el);
          return acc;
        },
        {}
      );

      console.log(
        "SpatialHierarchyNode: Element types in model:",
        Object.keys(grouped)
      );

      setSpatialElements(spatial);
      setElementsByType(grouped);

      // Set default selections if needed
      setupDefaultSelections(elements, spatial, grouped, spatialTypes);
    };

    // Add a function to create a spatial hierarchy from containment references
    const createSpatialHierarchyFromContainment = (
      elements: EnhancedIfcElement[],
      elementsWithContainers: EnhancedIfcElement[]
    ) => {
      // Find all unique container IDs
      const containerIds = [
        ...new Set(
          elementsWithContainers.map((el) => el.containedIn).filter(Boolean)
        ),
      ];

      console.log("SpatialHierarchyNode: Found container IDs:", containerIds);

      // Try to find container elements in the model
      const containerElements = elements.filter(
        (el) => el.id && containerIds.includes(el.id)
      );

      if (containerElements.length > 0) {
        console.log(
          "SpatialHierarchyNode: Found container elements:",
          containerElements.map((el) => el.type).join(", ")
        );

        // Mark container elements as spatial
        containerElements.forEach((el) => {
          el.isSpatial = true;

          // Set the spatial level based on element type
          switch (el.type.toUpperCase()) {
            case "IFCPROJECT":
              el.spatialLevel = 0;
              break;
            case "IFCSITE":
              el.spatialLevel = 1;
              break;
            case "IFCBUILDING":
              el.spatialLevel = 2;
              break;
            case "IFCBUILDINGSTOREY":
              el.spatialLevel = 3;
              break;
            case "IFCSPACE":
              el.spatialLevel = 4;
              break;
          }

          // Set spatialChildren to be the elements contained in this element
          el.spatialChildren = elementsWithContainers
            .filter((contained) => contained.containedIn === el.id)
            .map((contained) => contained.id);
        });
      }
    };

    // Add a function to create a virtual spatial hierarchy
    const createVirtualSpatialHierarchy = (elements: EnhancedIfcElement[]) => {
      // Create virtual project, building, and storey
      const now = Date.now();

      // Create project
      const virtualProject: EnhancedIfcElement = {
        id: `virtual-project-${now}`,
        expressId: -1,
        type: "IFCPROJECT",
        properties: {
          GlobalId: `virtual-project-${now}`,
          Name: "Default Project",
        },
        isSpatial: true,
        spatialLevel: 0,
        spatialChildren: [],
      };

      // Create building
      const virtualBuilding: EnhancedIfcElement = {
        id: `virtual-building-${now}`,
        expressId: -2,
        type: "IFCBUILDING",
        properties: {
          GlobalId: `virtual-building-${now}`,
          Name: "Default Building",
        },
        isSpatial: true,
        spatialLevel: 2,
        spatialChildren: [],
        containedIn: virtualProject.id,
      };

      // Create storey
      const virtualStorey: EnhancedIfcElement = {
        id: `virtual-storey-${now}`,
        expressId: -3,
        type: "IFCBUILDINGSTOREY",
        properties: {
          GlobalId: `virtual-storey-${now}`,
          Name: "Default Storey",
          Elevation: 0.0,
        },
        isSpatial: true,
        spatialLevel: 3,
        spatialChildren: [],
        containedIn: virtualBuilding.id,
      };

      // Add relationships between virtual elements
      virtualProject.spatialChildren!.push(virtualBuilding.id);
      virtualBuilding.spatialChildren!.push(virtualStorey.id);

      // Add all non-spatial elements to the virtual storey
      const nonSpatialElements = elements.filter(
        (el) =>
          ![
            "IFCPROJECT",
            "IFCSITE",
            "IFCBUILDING",
            "IFCBUILDINGSTOREY",
            "IFCSPACE",
          ].includes(el.type.toUpperCase())
      );

      if (nonSpatialElements.length > 0) {
        console.log(
          `Adding ${nonSpatialElements.length} non-spatial elements to virtual storey`
        );

        // Set containment for these elements
        nonSpatialElements.forEach((el) => {
          el.containedIn = virtualStorey.id;
        });

        // Add these elements to the storey's children
        virtualStorey.spatialChildren!.push(
          ...nonSpatialElements.map((el) => el.id)
        );
      }

      // Add the virtual elements to the original elements array
      elements.push(virtualProject);
      elements.push(virtualBuilding);
      elements.push(virtualStorey);

      console.log("SpatialHierarchyNode: Created virtual spatial hierarchy");
    };

    // Add a function to set default selections
    const setupDefaultSelections = (
      elements: EnhancedIfcElement[],
      spatial: EnhancedIfcElement[],
      grouped: Record<string, EnhancedIfcElement[]>,
      spatialTypes: string[]
    ) => {
      // Set default selections if properties don't exist or are empty
      const shouldSetDefaults =
        !data.properties ||
        Object.keys(data.properties).filter(
          (key) =>
            key !== "spatialType" &&
            key !== "elementType" &&
            data.properties?.[key]
        ).length === 0;

      if (shouldSetDefaults && data.updateNodeData) {
        const defaultProperties: Record<string, string> = {
          ...(data.properties || {}),
        };

        // First try to set spatial type
        let foundSpatialElement = false;

        // If we have spatial elements, use them
        if (spatial.length > 0) {
          // Set default selections for each spatial type if available
          for (const type of spatialTypes) {
            if (grouped[type]?.[0]) {
              defaultProperties[type.toLowerCase()] = grouped[type][0].id;
              foundSpatialElement = true;
            }
          }

          // Set spatialType to the first available spatial type
          for (const type of spatialTypes) {
            if (grouped[type]?.[0]) {
              defaultProperties.spatialType = type;
              break;
            }
          }
        }

        // If no spatial elements, use a direct element type
        if (!foundSpatialElement) {
          // Find the first element type with elements
          const elementTypes = Object.keys(grouped);
          if (elementTypes.length > 0) {
            defaultProperties.elementType = elementTypes[0];
            console.log(
              `SpatialHierarchyNode: No spatial elements found, using ${elementTypes[0]} as direct element type`
            );
          }
        }

        console.log(
          "SpatialHierarchyNode: Setting default properties:",
          defaultProperties
        );

        // Update node data with default properties
        data.updateNodeData({
          ...data,
          properties: defaultProperties,
        });
      }
    };

    // Handle selection change
    const handleSelectionChange = (type: string, value: string) => {
      if (data.updateNodeData) {
        data.updateNodeData({
          ...data,
          properties: {
            ...(data.properties || {}),
            [type]: value,
            spatialType: data.properties?.spatialType || "IFCBUILDINGSTOREY", // Default
          },
        });
      }
    };

    // Handle spatial type change
    const handleSpatialTypeChange = (value: string) => {
      if (data.updateNodeData) {
        data.updateNodeData({
          ...data,
          properties: {
            ...(data.properties || {}),
            spatialType: value,
          },
        });
      }
    };

    // Get the icon for a spatial type
    const getTypeIcon = (type: string) => {
      switch (type) {
        case "IFCPROJECT":
          return <Layers className="h-4 w-4 mr-2" />;
        case "IFCSITE":
          return <TreeDeciduous className="h-4 w-4 mr-2" />;
        case "IFCBUILDING":
          return <Building className="h-4 w-4 mr-2" />;
        case "IFCBUILDINGSTOREY":
          return <Building2 className="h-4 w-4 mr-2" />;
        case "IFCSPACE":
          return <HomeIcon className="h-4 w-4 mr-2" />;
        default:
          return <Layers className="h-4 w-4 mr-2" />;
      }
    };

    // Add a function to extract property sets and quantities
    const extractPropertyInfo = (element: IfcElement) => {
      const propertyInfo: Record<string, any> = {};

      // Extract properties from both direct properties and property sets
      if (element.properties) {
        Object.entries(element.properties).forEach(([key, value]) => {
          propertyInfo[key] = value;
        });
      }

      if (element.psets) {
        Object.entries(element.psets).forEach(([psetName, pset]) => {
          if (typeof pset === "object" && pset !== null) {
            Object.entries(pset as Record<string, any>).forEach(
              ([propName, propValue]) => {
                propertyInfo[`${psetName}.${propName}`] = propValue;
              }
            );
          }
        });
      }

      return propertyInfo;
    };

    // Add a function to get a better display name for an element
    const getElementDisplayName = (element: IfcElement) => {
      if (!element) return "Unknown";

      const propertyInfo = extractPropertyInfo(element);
      let name = element.properties?.Name || "";

      // If there's a LongName available, include it
      if (element.properties?.LongName) {
        name += ` (${element.properties.LongName})`;
      }

      // If there's no name but we have a description, use that instead
      if (!name && element.properties?.Description) {
        name = element.properties.Description;
      }

      // Last resort, use the ID with type info
      if (!name) {
        name = `${element.type} #${element.id}`;
      }

      return name;
    };

    // Get selected element name for display
    const getSelectedElementName = (type: string) => {
      if (!data.properties?.[type.toLowerCase()]) return "None";

      const selectedId = data.properties[type.toLowerCase()];
      const elements = elementsByType[type] || [];
      const element = elements.find((el) => el.id === selectedId);

      return element ? getElementDisplayName(element) : "Unknown";
    };

    // Add a function after getSelectedElementName to analyze and display the model's spatial structure
    // Build tree view data from spatial hierarchy
    const buildSpatialTree = () => {
      if (!data.inputData?.elements || !data.inputData.elements.length) {
        return [];
      }

      const elements = data.inputData.elements as EnhancedIfcElement[];

      // First, find the project element
      const project = elements.find(
        (el) => el.type.toUpperCase() === "IFCPROJECT"
      );
      if (!project) return [];

      // Recursive function to build tree
      const buildNodeTree = (element: EnhancedIfcElement): SpatialTreeNode => {
        // Get element info
        const name = getElementDisplayName(element);
        const hasChildren =
          element.spatialChildren && element.spatialChildren.length > 0;

        // Create node with containedElements property
        const node: SpatialTreeNode = {
          id: element.id,
          name: name,
          type: element.type,
          children: [],
        };

        // Add children if any
        if (hasChildren && element.spatialChildren) {
          for (const childId of element.spatialChildren) {
            const childElement = elements.find((el) => el.id === childId);
            if (childElement) {
              // Only add spatial elements to the spatial tree
              if (childElement.isSpatial) {
                node.children.push(buildNodeTree(childElement));
              }
            }
          }

          // Also count non-spatial contents
          let nonSpatialCount = 0;
          if (element.spatialChildren) {
            nonSpatialCount = element.spatialChildren.filter((childId) => {
              const child = elements.find((el) => el.id === childId);
              return child && !child.isSpatial;
            }).length;

            if (nonSpatialCount > 0) {
              node.containedElements = nonSpatialCount;
            }
          }
        }

        return node;
      };

      // Build the full tree starting from project
      return project ? [buildNodeTree(project)] : [];
    };

    // Tree view component for spatial hierarchy
    const TreeNode = ({
      node,
      level = 0,
    }: {
      node: SpatialTreeNode;
      level?: number;
    }) => {
      const [isOpen, setIsOpen] = useState(true);
      const hasChildren = node.children && node.children.length > 0;

      const getIcon = () => {
        switch (node.type.toUpperCase()) {
          case "IFCPROJECT":
            return <Layers className="h-3.5 w-3.5 mr-1" />;
          case "IFCSITE":
            return <TreeDeciduous className="h-3.5 w-3.5 mr-1" />;
          case "IFCBUILDING":
            return <Building className="h-3.5 w-3.5 mr-1" />;
          case "IFCBUILDINGSTOREY":
            return <Building2 className="h-3.5 w-3.5 mr-1" />;
          case "IFCSPACE":
            return <HomeIcon className="h-3.5 w-3.5 mr-1" />;
          default:
            return <div className="w-3.5 h-3.5 mr-1" />;
        }
      };

      const handleSelect = () => {
        // Get the proper property key based on the node type
        const propKey = node.type.toLowerCase();

        // Update the node data with the selection
        if (data.updateNodeData) {
          data.updateNodeData({
            ...data,
            properties: {
              ...(data.properties || {}),
              [propKey]: node.id,
              spatialType: node.type.toUpperCase(),
            },
          });
        }
      };

      // Style based on selection
      const isSelected = data.properties?.[node.type.toLowerCase()] === node.id;

      return (
        <div className="text-xs select-none">
          <div
            className={`flex items-center py-0.5 hover:bg-violet-50 cursor-pointer ${
              isSelected ? "bg-violet-100 font-medium" : ""
            }`}
            style={{ paddingLeft: `${level * 0.75}rem` }}
          >
            {hasChildren ? (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-3.5 h-3.5 flex-none flex items-center justify-center text-gray-500 hover:text-gray-800"
              >
                {isOpen ? "−" : "+"}
              </button>
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
            <div
              className="flex items-center hover:text-violet-800"
              onClick={handleSelect}
            >
              {getIcon()}
              <span className="truncate">{node.name}</span>
              {node.containedElements && node.containedElements > 0 && (
                <span className="ml-1 text-xs text-gray-500">
                  ({node.containedElements})
                </span>
              )}
            </div>
          </div>

          {isOpen && hasChildren && (
            <div className="ml-2">
              {node.children.map((child) => (
                <TreeNode key={child.id} node={child} level={level + 1} />
              ))}
            </div>
          )}
        </div>
      );
    };

    // Build the spatial tree data
    const spatialTree = buildSpatialTree();

    // Add a recursive tree component for displaying spatial hierarchy
    const SpatialTreeView = ({
      elements,
      model,
    }: {
      elements: EnhancedIfcElement[];
      model?: any;
    }) => {
      // Function to build the tree from the spatial hierarchy
      const buildTreeData = () => {
        if (!elements || elements.length === 0) {
          return [];
        }

        // First try to find the project element as root
        const projectElements = elements.filter(
          (el) => el.type.toUpperCase() === "IFCPROJECT"
        );

        // If no project, try to find buildings
        if (projectElements.length === 0) {
          const buildings = elements.filter(
            (el) => el.type.toUpperCase() === "IFCBUILDING"
          );

          if (buildings.length > 0) {
            return buildings.map((building) => renderTreeNode(building));
          }

          // If no buildings either, try to find storeys
          const storeys = elements.filter(
            (el) => el.type.toUpperCase() === "IFCBUILDINGSTOREY"
          );

          if (storeys.length > 0) {
            return storeys.map((storey) => renderTreeNode(storey));
          }

          return [];
        }

        // Use project as root
        return projectElements.map((project) => renderTreeNode(project));
      };

      // Function to render a node and its children recursively
      const renderTreeNode = (element: EnhancedIfcElement) => {
        // Get element display name
        const name = element.properties?.Name || element.type;
        const type = element.type.replace("Ifc", "");
        const elementId = element.properties?.GlobalId || element.id;

        // Check if this element has children
        const hasChildren =
          element.spatialChildren && element.spatialChildren.length > 0;

        // Get contained elements if any
        const childElements = hasChildren
          ? (element.spatialChildren
              ?.map((childId: string) =>
                elements.find(
                  (el) =>
                    el.properties?.GlobalId === childId || el.id === childId
                )
              )
              .filter(Boolean) as EnhancedIfcElement[])
          : [];

        // Get icon based on element type
        const getIcon = () => {
          switch (element.type.toUpperCase()) {
            case "IFCPROJECT":
              return <Layers className="h-4 w-4 text-blue-500" />;
            case "IFCSITE":
              return <TreeDeciduous className="h-4 w-4 text-green-500" />;
            case "IFCBUILDING":
              return <Building className="h-4 w-4 text-violet-500" />;
            case "IFCBUILDINGSTOREY":
              return <Building2 className="h-4 w-4 text-purple-500" />;
            case "IFCSPACE":
              return <HomeIcon className="h-4 w-4 text-indigo-500" />;
            default:
              return null;
          }
        };

        // If this is just a basic element without children, render a simple node
        if (!hasChildren) {
          return (
            <div key={elementId} className="ml-2 flex items-center">
              {getIcon()}
              <span className="ml-1 text-xs">{name}</span>
              <span className="ml-1 text-xs text-gray-400">({type})</span>
            </div>
          );
        }

        // For container elements with children, render with collapsible children
        return (
          <div key={elementId} className="ml-2">
            <div className="flex items-center">
              {getIcon()}
              <span className="ml-1 text-xs font-medium">{name}</span>
              <span className="ml-1 text-xs text-gray-400">({type})</span>
              <span className="ml-1 text-xs text-gray-400">
                ({childElements.length} items)
              </span>
            </div>

            <div className="ml-4 border-l border-gray-200 pl-2">
              {childElements.map((child) => renderTreeNode(child))}
            </div>
          </div>
        );
      };

      // Render the tree
      const treeData = buildTreeData();

      if (treeData.length === 0) {
        // If no spatial elements found, show message
        return (
          <div className="p-1 text-xs text-gray-500">
            No spatial hierarchy found in model
          </div>
        );
      }

      return <div className="p-1 overflow-auto max-h-60">{treeData}</div>;
    };

    // Add a model summary component
    const ModelSummary = ({
      elements,
      elementsByType,
    }: {
      elements: EnhancedIfcElement[];
      elementsByType: Record<string, EnhancedIfcElement[]>;
    }) => {
      // Count different types of elements
      const spatialTypes = [
        "IFCPROJECT",
        "IFCSITE",
        "IFCBUILDING",
        "IFCBUILDINGSTOREY",
        "IFCSPACE",
      ];

      const spatialElements = elements.filter((el) =>
        spatialTypes.includes(el.type.toUpperCase())
      );

      const totalElements = elements.length;
      const totalSpatial = spatialElements.length;
      const totalRegular = totalElements - totalSpatial;

      // Get top 3 element types by count
      const topTypes = Object.entries(elementsByType)
        .filter(([type]) => !spatialTypes.includes(type))
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3);

      return (
        <div className="text-xs bg-gray-50 rounded p-2 space-y-1">
          <div className="font-medium">Model Summary</div>
          <div className="flex justify-between">
            <span>Total Elements:</span>
            <span className="font-medium">{totalElements}</span>
          </div>
          {spatialElements.length > 0 && (
            <div className="flex justify-between">
              <span>Spatial Elements:</span>
              <span className="font-medium">{totalSpatial}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Regular Elements:</span>
            <span className="font-medium">{totalRegular}</span>
          </div>

          {topTypes.length > 0 && (
            <div className="mt-1">
              <div className="font-medium">Top Element Types:</div>
              {topTypes.map(([type, els]) => (
                <div key={type} className="flex justify-between">
                  <span>{type.replace("IFC", "")}</span>
                  <span className="font-medium">{els.length}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        className="bg-white border-2 border-violet-500 rounded-md w-56 shadow-md"
        style={selected ? nodeStyle.selected : nodeStyle.default}
      >
        <div className="bg-violet-500 text-white px-3 py-1 flex items-center gap-2">
          <Building className="h-4 w-4" />
          <div className="text-sm font-medium truncate">
            {data.label || "Spatial Hierarchy"}
          </div>
        </div>

        <div className="p-3 space-y-3 text-xs">
          {/* Render the model summary if we have elements */}
          {data.inputData?.elements && (
            <ModelSummary
              elements={data.inputData.elements as EnhancedIfcElement[]}
              elementsByType={
                elementsByType as Record<string, EnhancedIfcElement[]>
              }
            />
          )}

          {/* Add spatial tree view */}
          {data.inputData?.elements && (
            <div className="border rounded">
              <div className="bg-gray-50 px-2 py-1 font-medium text-xs border-b">
                Spatial Structure
              </div>
              <SpatialTreeView
                elements={data.inputData.elements as EnhancedIfcElement[]}
              />
            </div>
          )}

          {/* Display error message if present */}
          {data.error && (
            <div className="text-red-500 text-xs p-1 bg-red-50 rounded border border-red-200 mt-2">
              {data.error}
            </div>
          )}

          {/* Show element type selection */}
          <div className="mt-3">
            {/* Spatial Type Selector - always shown */}
            <div className="space-y-1">
              <Label htmlFor="spatialType">Output Type</Label>
              <Select
                value={data.properties?.spatialType || "IFCBUILDINGSTOREY"}
                onValueChange={(value) => handleSpatialTypeChange(value)}
              >
                <SelectTrigger id="spatialType" className="h-7 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IFCPROJECT" className="text-xs">
                    <div className="flex items-center">
                      {getTypeIcon("IFCPROJECT")}
                      Project
                    </div>
                  </SelectItem>
                  <SelectItem value="IFCSITE" className="text-xs">
                    <div className="flex items-center">
                      {getTypeIcon("IFCSITE")}
                      Site
                    </div>
                  </SelectItem>
                  <SelectItem value="IFCBUILDING" className="text-xs">
                    <div className="flex items-center">
                      {getTypeIcon("IFCBUILDING")}
                      Building
                    </div>
                  </SelectItem>
                  <SelectItem value="IFCBUILDINGSTOREY" className="text-xs">
                    <div className="flex items-center">
                      {getTypeIcon("IFCBUILDINGSTOREY")}
                      Building Storey
                    </div>
                  </SelectItem>
                  <SelectItem value="IFCSPACE" className="text-xs">
                    <div className="flex items-center">
                      {getTypeIcon("IFCSPACE")}
                      Space
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Input handle for IFC model data */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="w-2 h-2 bg-blue-500 border-blue-500"
          isConnectable={isConnectable}
        />

        {/* Output handle to provide the selected spatial elements */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="w-2 h-2"
          isConnectable={isConnectable}
        />
      </div>
    );
  }
);

SpatialHierarchyNode.displayName = "SpatialHierarchyNode";

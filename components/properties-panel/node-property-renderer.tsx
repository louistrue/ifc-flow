"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useRef } from "react";
import { getModelPropertyNames, getModelPsets, getModelPsetsFromSqlite, getModelPropertiesFromSqlite, getModelPropertiesForPsetFromSqlite, getSqliteWarmStatus, getLastLoadedModel } from "@/lib/ifc-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTransformEditor } from "./property-editors/data-transform-editor";

interface NodePropertyRendererProps {
  node: any;
  properties: any;
  setProperties: (properties: any) => void;
}

export function NodePropertyRenderer({
  node,
  properties,
  setProperties,
}: NodePropertyRendererProps) {
  const [modelProps, setModelProps] = useState<string[]>([]);
  const [modelPsets, setModelPsets] = useState<string[]>([]);
  const [sqliteReady, setSqliteReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastStatusRef = useRef<string>('');

  // Check SQLite status and load data when ready
  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout | null = null;

    const loadData = async (forceReload = false) => {
      if (!mounted) return;

      const model = getLastLoadedModel();
      const status = model ? getSqliteWarmStatus(model) : 'idle';

      // Skip if status hasn't changed and not forced
      if (!forceReload && status === lastStatusRef.current) {
        return;
      }
      lastStatusRef.current = status;

      // Only query SQLite if it's ready
      if (status === 'ready') {
        setSqliteReady(true);
        setIsLoading(true);

        // Try to load from SQLite
        const psets = await getModelPsetsFromSqlite();
        if (!mounted) return;

        if (psets.length > 0) {
          setModelPsets(psets);
        } else {
          setModelPsets(getModelPsets());
        }

        // Fetch properties based on selected Pset
        let props: string[] = [];
        if (properties.targetPset && properties.targetPset !== "any" && properties.targetPset !== "CustomProperties") {
          // When a specific pset is selected, ONLY show properties from that pset
          props = await getModelPropertiesForPsetFromSqlite(undefined, properties.targetPset);
          if (!mounted) return;
          setModelProps(props.length > 0 ? props : []);
        } else {
          // If no specific pset selected, fetch all properties
          props = await getModelPropertiesFromSqlite();
          if (!mounted) return;
          if (props.length > 0) {
            setModelProps(props);
          } else {
            setModelProps(getModelPropertyNames());
          }
        }

        if (mounted) setIsLoading(false);
      } else {
        // SQLite not ready - use in-memory fallback for now
        setSqliteReady(false);
        setIsLoading(false);
        setModelPsets(getModelPsets());
        setModelProps(getModelPropertyNames());
      }
    };

    // Initial load
    loadData(true);

    // Debounced handler for events
    const handleSqliteEvent = () => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = setTimeout(() => {
        loadData(false);
      }, 100);
    };

    window.addEventListener('sqlite:ready', handleSqliteEvent);
    window.addEventListener('sqlite:warmStatus', handleSqliteEvent);

    return () => {
      mounted = false;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      window.removeEventListener('sqlite:ready', handleSqliteEvent);
      window.removeEventListener('sqlite:warmStatus', handleSqliteEvent);
    };
  }, [node, properties.targetPset]);
  // Return null for ifcNode type to prevent properties panel from rendering anything
  if (node.type === "ifcNode") {
    return null;
  }

  switch (node.type) {
    case "geometryNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="elementType">Element Type</Label>
            <Select
              value={properties.elementType || "all"}
              onValueChange={(value) =>
                setProperties({ ...properties, elementType: value })
              }
            >
              <SelectTrigger id="elementType">
                <SelectValue placeholder="Select element type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Elements</SelectItem>
                <SelectItem value="walls">Walls</SelectItem>
                <SelectItem value="slabs">Slabs</SelectItem>
                <SelectItem value="columns">Columns</SelectItem>
                <SelectItem value="beams">Beams</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="includeOpenings">Include Openings</Label>
            <Select
              value={properties.includeOpenings || "true"}
              onValueChange={(value) =>
                setProperties({ ...properties, includeOpenings: value })
              }
            >
              <SelectTrigger id="includeOpenings">
                <SelectValue placeholder="Include openings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="useActualGeometry">Use Actual Geometry</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useActualGeometry"
                  checked={properties.useActualGeometry || false}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      useActualGeometry: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              When enabled, uses IFCOpenShell GEOM for more accurate geometry
              extraction
            </div>
          </div>
        </div>
      );

    case "filterNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filterType">Filter Type</Label>
            <Select
              value={properties.filterType || "property"}
              onValueChange={(value) =>
                setProperties({ ...properties, filterType: value })
              }
            >
              <SelectTrigger id="filterType">
                <SelectValue placeholder="Select filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="ifcClass">IFC Class</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {properties.filterType === "property" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="property">Property</Label>
                <Input
                  id="property"
                  list="model-properties"
                  value={properties.property || ""}
                  onChange={(e) =>
                    setProperties({ ...properties, property: e.target.value })
                  }
                  placeholder="e.g. Pset_WallCommon.FireRating"
                />
                {modelProps.length > 0 && (
                  <datalist id="model-properties">
                    {modelProps.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="operator">Operator</Label>
                <Select
                  value={properties.operator || "equals"}
                  onValueChange={(value) =>
                    setProperties({ ...properties, operator: value })
                  }
                >
                  <SelectTrigger id="operator">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                    <SelectItem value="endsWith">Ends With</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={properties.value || ""}
                  onChange={(e) =>
                    setProperties({ ...properties, value: e.target.value })
                  }
                  placeholder="Value to match"
                />
              </div>
            </>
          )}

          {properties.filterType === "ifcClass" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ifcClass">IFC Class</Label>
                <Input
                  id="ifcClass"
                  list="ifc-classes"
                  value={properties.ifcClass || ""}
                  onChange={(e) =>
                    setProperties({ ...properties, ifcClass: e.target.value })
                  }
                  placeholder="e.g. IfcWall, IfcDoor, Wall"
                />
                <datalist id="ifc-classes">
                  <option value="IfcWall" />
                  <option value="IfcDoor" />
                  <option value="IfcWindow" />
                  <option value="IfcSlab" />
                  <option value="IfcColumn" />
                  <option value="IfcBeam" />
                  <option value="IfcSpace" />
                  <option value="IfcStair" />
                  <option value="IfcRoof" />
                  <option value="IfcRailing" />
                  <option value="IfcCurtainWall" />
                  <option value="IfcPlate" />
                  <option value="IfcWallStandardCase" />
                  <option value="IfcDoorStandardCase" />
                  <option value="IfcWindowStandardCase" />
                </datalist>
                <div className="text-xs text-muted-foreground">
                  Use "contains" operator with "Wall" to match both "IfcWall" and "IfcWallStandardCase"
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="operator">Operator</Label>
                <Select
                  value={properties.operator || "contains"}
                  onValueChange={(value) =>
                    setProperties({ ...properties, operator: value })
                  }
                >
                  <SelectTrigger id="operator">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                    <SelectItem value="endsWith">Ends With</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      );

    case "transformNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Translation</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="translateX" className="text-xs">
                  X
                </Label>
                <Input
                  id="translateX"
                  type="number"
                  value={properties.translateX || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      translateX: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="translateY" className="text-xs">
                  Y
                </Label>
                <Input
                  id="translateY"
                  type="number"
                  value={properties.translateY || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      translateY: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="translateZ" className="text-xs">
                  Z
                </Label>
                <Input
                  id="translateZ"
                  type="number"
                  value={properties.translateZ || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      translateZ: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rotation (degrees)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="rotateX" className="text-xs">
                  X
                </Label>
                <Input
                  id="rotateX"
                  type="number"
                  value={properties.rotateX || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      rotateX: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="rotateY" className="text-xs">
                  Y
                </Label>
                <Input
                  id="rotateY"
                  type="number"
                  value={properties.rotateY || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      rotateY: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="rotateZ" className="text-xs">
                  Z
                </Label>
                <Input
                  id="rotateZ"
                  type="number"
                  value={properties.rotateZ || 0}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      rotateZ: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Scale</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="scaleX" className="text-xs">
                  X
                </Label>
                <Input
                  id="scaleX"
                  type="number"
                  value={properties.scaleX || 1}
                  onChange={(e) =>
                    setProperties({ ...properties, scaleX: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="scaleY" className="text-xs">
                  Y
                </Label>
                <Input
                  id="scaleY"
                  type="number"
                  value={properties.scaleY || 1}
                  onChange={(e) =>
                    setProperties({ ...properties, scaleY: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="scaleZ" className="text-xs">
                  Z
                </Label>
                <Input
                  id="scaleZ"
                  type="number"
                  value={properties.scaleZ || 1}
                  onChange={(e) =>
                    setProperties({ ...properties, scaleZ: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      );

    case "viewerNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="viewMode">View Mode</Label>
            <Select
              value={properties.viewMode || "shaded"}
              onValueChange={(value) =>
                setProperties({ ...properties, viewMode: value })
              }
            >
              <SelectTrigger id="viewMode">
                <SelectValue placeholder="Select view mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shaded">Shaded</SelectItem>
                <SelectItem value="wireframe">Wireframe</SelectItem>
                <SelectItem value="hidden">Hidden Line</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="colorBy">Color By</Label>
            <Select
              value={properties.colorBy || "type"}
              onValueChange={(value) =>
                setProperties({ ...properties, colorBy: value })
              }
            >
              <SelectTrigger id="colorBy">
                <SelectValue placeholder="Select coloring method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="type">Element Type</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "quantityNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantityType">Quantity Type</Label>
            <Select
              value={properties.quantityType || "area"}
              onValueChange={(value) =>
                setProperties({ ...properties, quantityType: value })
              }
            >
              <SelectTrigger id="quantityType">
                <SelectValue placeholder="Select quantity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="length">Length</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="groupBy">Group By</Label>
            <Select
              value={properties.groupBy || "none"}
              onValueChange={(value) =>
                setProperties({ ...properties, groupBy: value })
              }
            >
              <SelectTrigger id="groupBy">
                <SelectValue placeholder="Select grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="type">Element Type</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="level">Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={properties.unit || ""}
              onChange={(e) =>
                setProperties({ ...properties, unit: e.target.value })
              }
              placeholder="e.g. m, m², m³"
            />
          </div>
        </div>
      );

    case "propertyNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={properties.source || "property"}
              onValueChange={(value) =>
                setProperties({
                  ...properties,
                  source: value,
                  action: "get",
                  // Set default attribute name when switching to attribute source
                  propertyName: value === "attribute" ? (properties.propertyName || "Name") : properties.propertyName
                })
              }
            >
              <SelectTrigger id="source">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="attribute">Attribute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select
              value={properties.action || "get"}
              onValueChange={(value) =>
                setProperties({ ...properties, action: value })
              }
            >
              <SelectTrigger id="action">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="get">Get {properties.source === "attribute" ? "Attribute" : "Property"}</SelectItem>
                <SelectItem value="set">Set {properties.source === "attribute" ? "Attribute" : "Property"}</SelectItem>
                {properties.source !== "attribute" && (
                  <>
                    <SelectItem value="add">Add Property</SelectItem>
                    <SelectItem value="remove">Remove Property</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {properties.source !== "attribute" && (
            <div className="space-y-2">
              <Label htmlFor="targetPset">
                Property Set
                {isLoading && <span className="ml-2 text-xs text-muted-foreground">(loading...)</span>}
                {!isLoading && !sqliteReady && <span className="ml-2 text-xs text-amber-500">(building database...)</span>}
              </Label>
              {(properties.action || "get") === "get" ? (
                <SearchableSelect
                  value={properties.targetPset || ""}
                  onChange={(value) =>
                    setProperties({ ...properties, targetPset: value })
                  }
                  options={[
                    "any",
                    "CustomProperties",
                    ...modelPsets.filter(p => p !== "CustomProperties")
                  ]}
                  placeholder={isLoading ? "Loading property sets..." : "Select property set..."}
                  disabled={isLoading}
                />
              ) : (
                <Select
                  value={properties.targetPset || ""}
                  onValueChange={(value) =>
                    setProperties({ ...properties, targetPset: value })
                  }
                >
                  <SelectTrigger id="targetPset">
                    <SelectValue placeholder="Select property set" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px] overflow-y-auto">
                    <SelectItem value="any">Any Property Set</SelectItem>
                    {modelPsets.map((pset) => (
                      <SelectItem key={pset} value={pset}>
                        {pset}
                      </SelectItem>
                    ))}
                    <SelectItem value="CustomProperties">
                      CustomProperties
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="text-xs text-muted-foreground">
                For "get" action: Where to look for the property (optional). For
                "set/add" actions: Where to add the property.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="propertyName">{properties.source === "attribute" ? "Attribute Name" : "Property Name"}</Label>
            {properties.source === "attribute" ? (
              <Select
                value={properties.propertyName || "Name"}
                onValueChange={(value) =>
                  setProperties({ ...properties, propertyName: value })
                }
              >
                <SelectTrigger id="attributeName">
                  <SelectValue placeholder="Select attribute" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Name">Name</SelectItem>
                  <SelectItem value="Description">Description</SelectItem>
                  <SelectItem value="GlobalId">GlobalId</SelectItem>
                  <SelectItem value="Tag">Tag</SelectItem>
                  <SelectItem value="ObjectType">ObjectType</SelectItem>
                  <SelectItem value="PredefinedType">PredefinedType</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <>
                {(properties.action || "get") === "get" ? (
                  <SearchableSelect
                    value={properties.propertyName || ""}
                    onChange={(value) =>
                      setProperties({
                        ...properties,
                        propertyName: value,
                      })
                    }
                    options={modelProps}
                    placeholder={isLoading ? "Loading properties..." : "Select property..."}
                    disabled={isLoading}
                  />
                ) : (
                  <Input
                    id="propertyName"
                    value={properties.propertyName || ""}
                    onChange={(e) =>
                      setProperties({
                        ...properties,
                        propertyName: e.target.value,
                      })
                    }
                    placeholder="e.g. IsExternal, FireRating"
                  />
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Common properties: IsExternal, FireRating, LoadBearing,
                  ThermalTransmittance
                </div>
                <div className="text-xs text-muted-foreground">
                  Use dot notation to override Property Set: MyCustomPset.MyProperty
                </div>
              </>
            )}
          </div>

          {(properties.action === "set" || properties.action === "add") && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="useValueInput">Use Value Input</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useValueInput"
                      checked={properties.useValueInput || false}
                      onChange={(e) =>
                        setProperties({
                          ...properties,
                          useValueInput: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  When enabled, property values will be taken from the top input
                  connection
                </div>
              </div>
              {!properties.useValueInput && (
                <div className="space-y-2">
                  <Label htmlFor="propertyValue">Property Value</Label>
                  <Input
                    id="propertyValue"
                    value={properties.propertyValue || ""}
                    onChange={(e) =>
                      setProperties({
                        ...properties,
                        propertyValue: e.target.value,
                      })
                    }
                    placeholder="Property value"
                  />
                </div>
              )}
            </>
          )}
        </div>
      );

    case "classificationNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system">Classification System</Label>
            <Select
              value={properties.system || "uniclass"}
              onValueChange={(value) =>
                setProperties({ ...properties, system: value })
              }
            >
              <SelectTrigger id="system">
                <SelectValue placeholder="Select system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniclass">Uniclass</SelectItem>
                <SelectItem value="omniclass">OmniClass</SelectItem>
                <SelectItem value="uniformat">Uniformat</SelectItem>
                <SelectItem value="masterformat">MasterFormat</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select
              value={properties.action || "get"}
              onValueChange={(value) =>
                setProperties({ ...properties, action: value })
              }
            >
              <SelectTrigger id="action">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="get">Get Classification</SelectItem>
                <SelectItem value="set">Set Classification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {properties.action === "set" && (
            <div className="space-y-2">
              <Label htmlFor="code">Classification Code</Label>
              <Input
                id="code"
                value={properties.code || ""}
                onChange={(e) =>
                  setProperties({ ...properties, code: e.target.value })
                }
                placeholder="Classification code"
              />
            </div>
          )}
        </div>
      );

    case "spatialNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="queryType">Query Type</Label>
            <Select
              value={properties.queryType || "contained"}
              onValueChange={(value) =>
                setProperties({ ...properties, queryType: value })
              }
            >
              <SelectTrigger id="queryType">
                <SelectValue placeholder="Select query type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contained">Contained In</SelectItem>
                <SelectItem value="containing">Containing</SelectItem>
                <SelectItem value="intersecting">Intersecting</SelectItem>
                <SelectItem value="touching">Touching</SelectItem>
                <SelectItem value="within-distance">Within Distance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {properties.queryType === "within-distance" && (
            <div className="space-y-2">
              <Label htmlFor="distance">Distance (m)</Label>
              <Input
                id="distance"
                type="number"
                value={properties.distance || "1.0"}
                onChange={(e) =>
                  setProperties({ ...properties, distance: e.target.value })
                }
              />
            </div>
          )}
        </div>
      );

    case "exportNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select
              value={properties.format || "csv"}
              onValueChange={(value) =>
                setProperties({ ...properties, format: value })
              }
            >
              <SelectTrigger id="format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="ifc">IFC</SelectItem>
                <SelectItem value="glb">
                  <div className="flex items-center gap-2">
                    <span>glTF/GLB</span>
                    <Badge variant="secondary" className="text-xs">WIP</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={properties.fileName || "export"}
              onChange={(e) =>
                setProperties({ ...properties, fileName: e.target.value })
              }
            />
          </div>
          {properties.format === "glb" && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="mt-0.5">WIP</Badge>
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold mb-1">GLB Export is Work In Progress</p>
                  <p>The geometry extraction is simplified and doesn't accurately represent complex IFC elements.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case "relationshipNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="relationType">Relationship Type</Label>
            <Select
              value={properties.relationType || "containment"}
              onValueChange={(value) =>
                setProperties({ ...properties, relationType: value })
              }
            >
              <SelectTrigger id="relationType">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="containment">Containment</SelectItem>
                <SelectItem value="aggregation">Aggregation</SelectItem>
                <SelectItem value="voiding">Voiding</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="space-boundary">Space Boundary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={properties.direction || "outgoing"}
              onValueChange={(value) =>
                setProperties({ ...properties, direction: value })
              }
            >
              <SelectTrigger id="direction">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outgoing">Outgoing</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "analysisNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="analysisType">Analysis Type</Label>
            <Select
              value={properties.analysisType || "clash"}
              onValueChange={(value) =>
                setProperties({ ...properties, analysisType: value })
              }
            >
              <SelectTrigger id="analysisType">
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clash">Clash Detection</SelectItem>
                <SelectItem value="adjacency">Adjacency Analysis</SelectItem>
                <SelectItem value="space">Space Analysis</SelectItem>
                <SelectItem value="path">Path Finding</SelectItem>
                <SelectItem value="visibility">Visibility Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {properties.analysisType === "clash" && (
            <div className="space-y-2">
              <Label htmlFor="tolerance">Tolerance (mm)</Label>
              <Input
                id="tolerance"
                type="number"
                value={properties.tolerance || "10"}
                onChange={(e) =>
                  setProperties({
                    ...properties,
                    tolerance: e.target.value,
                  })
                }
              />
            </div>
          )}
          {properties.analysisType === "space" && (
            <div className="space-y-2">
              <Label htmlFor="metric">Metric</Label>
              <Select
                value={properties.metric || "area"}
                onValueChange={(value) =>
                  setProperties({ ...properties, metric: value })
                }
              >
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Area</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="occupancy">Occupancy</SelectItem>
                  <SelectItem value="circulation">Circulation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      );

    case "watchNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayMode">Display Mode</Label>
            <Select
              value={properties.displayMode || "table"}
              onValueChange={(value) =>
                setProperties({ ...properties, displayMode: value })
              }
            >
              <SelectTrigger id="displayMode">
                <SelectValue placeholder="Select display mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="raw">Raw JSON</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {properties.displayMode === "table" &&
                "Display data in a tabular format"}
              {properties.displayMode === "raw" && "Show raw JSON data"}
              {properties.displayMode === "summary" &&
                "Summarize data with counts and statistics"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoUpdate">Auto Update</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoUpdate"
                  checked={properties.autoUpdate || false}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      autoUpdate: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              When enabled, watch will update automatically when input changes
            </div>
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                // TODO: trigger a data refresh
                console.log("Refreshing watch data");
              }}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      );

    case "parameterNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paramType">Parameter Type</Label>
            <Select
              value={properties.paramType || "number"}
              onValueChange={(value) =>
                setProperties({ ...properties, paramType: value })
              }
            >
              <SelectTrigger id="paramType">
                <SelectValue placeholder="Select parameter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="list">List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {properties.paramType === "number" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={properties.value || "0"}
                  onChange={(e) =>
                    setProperties({ ...properties, value: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Range (Min/Max)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={properties.range?.min || ""}
                    onChange={(e) =>
                      setProperties({
                        ...properties,
                        range: { ...properties.range, min: e.target.value },
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={properties.range?.max || ""}
                    onChange={(e) =>
                      setProperties({
                        ...properties,
                        range: { ...properties.range, max: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {properties.paramType === "text" && (
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={properties.value || ""}
                onChange={(e) =>
                  setProperties({ ...properties, value: e.target.value })
                }
              />
            </div>
          )}

          {properties.paramType === "boolean" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="boolValue">Value</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="boolValue"
                    checked={properties.value === "true"}
                    onChange={(e) =>
                      setProperties({
                        ...properties,
                        value: e.target.checked ? "true" : "false",
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </div>
              </div>
            </div>
          )}

          {properties.paramType === "list" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="listItems">List Items (comma separated)</Label>
                <Input
                  id="listItems"
                  value={properties.listItems || ""}
                  onChange={(e) =>
                    setProperties({
                      ...properties,
                      listItems: e.target.value,
                    })
                  }
                  placeholder="Item1, Item2, Item3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selectedItem">Selected Item</Label>
                <Select
                  value={properties.value || ""}
                  onValueChange={(value) =>
                    setProperties({ ...properties, value })
                  }
                >
                  <SelectTrigger id="selectedItem">
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {(properties.listItems || "")
                      .split(",")
                      .map((item: string, index: number) => (
                        <SelectItem key={index} value={item.trim()}>
                          {item.trim()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      );

    case "pythonNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pythonCode">Python Code</Label>
            <textarea
              id="pythonCode"
              value={properties.code || "# Your Python code here\n# Access ifc_file, input_data, and properties\nresult = input_data"}
              onChange={(e) =>
                setProperties({ ...properties, code: e.target.value })
              }
              className="w-full h-32 font-mono text-sm border rounded-md p-2"
              placeholder="Write your Python code here..."
            />
            <div className="text-xs text-muted-foreground">
              Double-click the node to open the full Python editor
            </div>
          </div>
        </div>
      );

    case "dataTransformNode":
      return (
        <DataTransformEditor
          properties={properties}
          setProperties={setProperties}
        />
      );

    case "clusterNode":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Group By</label>
            <select
              value={properties?.groupBy || "type"}
              onChange={(e) => setProperties({ ...properties, groupBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="type">Element Type</option>
              <option value="level">Building Level</option>
              <option value="material">Material</option>
              <option value="property">Custom Property</option>
            </select>
          </div>

          {properties?.groupBy === "property" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Property Name</label>
                <input
                  type="text"
                  value={properties?.property || ""}
                  onChange={(e) => setProperties({ ...properties, property: e.target.value })}
                  placeholder="e.g., FireRating, LoadBearing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Property Set (Optional)</label>
                <input
                  type="text"
                  value={properties?.pset || ""}
                  onChange={(e) => setProperties({ ...properties, pset: e.target.value })}
                  placeholder="e.g., Pset_WallCommon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to search all property sets
                </p>
              </div>
            </>
          )}

          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded">
            <p className="font-medium mb-1">Clustering Info:</p>
            <p>• Groups elements by the selected criteria</p>
            <p>• Applies colors and enables visibility control</p>
            <p>• Requires an active 3D viewer with loaded model</p>
          </div>
        </div>
      );

    case "materialNode": {
      const { MaterialEditor } = require("./property-editors/material-editor");
      return <MaterialEditor properties={properties} setProperties={setProperties} />;
    }

    default:
      return (
        <div className="text-center text-sm text-muted-foreground py-4">
          No properties available for this node type.
        </div>
      );
  }
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  emptyMessage = "No results found.",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 max-h-[400px] overflow-hidden" align="start">
        <Command className="max-h-[400px]">
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList className="max-h-[350px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option === value ? "" : option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

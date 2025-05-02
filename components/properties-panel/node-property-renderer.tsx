"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  switch (node.type) {
    case "ifcNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">IFC File</Label>
            <div className="flex gap-2">
              <Input id="file" value={properties.file || ""} readOnly />
              <Button variant="secondary" size="sm">
                Browse
              </Button>
            </div>
          </div>
        </div>
      );

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
            <Label htmlFor="property">Property</Label>
            <Input
              id="property"
              value={properties.property || ""}
              onChange={(e) =>
                setProperties({ ...properties, property: e.target.value })
              }
              placeholder="e.g. Type, Material, etc."
            />
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
                <SelectItem value="get">Get Property</SelectItem>
                <SelectItem value="set">Set Property</SelectItem>
                <SelectItem value="add">Add Property</SelectItem>
                <SelectItem value="remove">Remove Property</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetPset">Property Set</Label>
            <Select
              value={properties.targetPset || ""}
              onValueChange={(value) =>
                setProperties({ ...properties, targetPset: value })
              }
            >
              <SelectTrigger id="targetPset">
                <SelectValue placeholder="Select property set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Property Set</SelectItem>
                <SelectItem value="Pset_WallCommon">Pset_WallCommon</SelectItem>
                <SelectItem value="Pset_BeamCommon">Pset_BeamCommon</SelectItem>
                <SelectItem value="Pset_SlabCommon">Pset_SlabCommon</SelectItem>
                <SelectItem value="Pset_ColumnCommon">
                  Pset_ColumnCommon
                </SelectItem>
                <SelectItem value="Pset_WindowCommon">
                  Pset_WindowCommon
                </SelectItem>
                <SelectItem value="Pset_DoorCommon">Pset_DoorCommon</SelectItem>
                <SelectItem value="Pset_BuildingCommon">
                  Pset_BuildingCommon
                </SelectItem>
                <SelectItem value="Pset_SpaceCommon">
                  Pset_SpaceCommon
                </SelectItem>
                <SelectItem value="CustomProperties">
                  CustomProperties
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              For "get" action: Where to look for the property (optional). For
              "set/add" actions: Where to add the property.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyName">Property Name</Label>
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
            <div className="text-xs text-muted-foreground">
              Common properties: IsExternal, FireRating, LoadBearing,
              ThermalTransmittance
            </div>
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
                <SelectItem value="glb">glTF/GLB</SelectItem>
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
          {(properties.format === "csv" ||
            properties.format === "excel" ||
            properties.format === "json") && (
            <div className="space-y-2">
              <Label htmlFor="properties">Include Properties</Label>
              <Input
                id="properties"
                value={properties.properties || "Name,Type,Material"}
                onChange={(e) =>
                  setProperties({
                    ...properties,
                    properties: e.target.value,
                  })
                }
                placeholder="Comma-separated properties"
              />
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
                // In a real app, this would trigger a data refresh
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
              {properties.listItems && (
                <div className="text-xs text-muted-foreground">
                  Current items:{" "}
                  {properties.listItems
                    .split(",")
                    .map((item: string) => item.trim())
                    .filter((item: string) => item)
                    .join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      );

    case "spatialHierarchyNode":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="outputType">Output Type</Label>
            <Select
              value={properties.spatialType || "IFCBUILDINGSTOREY"}
              onValueChange={(value) =>
                setProperties({ ...properties, spatialType: value })
              }
            >
              <SelectTrigger id="outputType">
                <SelectValue placeholder="Select output type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IFCPROJECT">Project</SelectItem>
                <SelectItem value="IFCSITE">Site</SelectItem>
                <SelectItem value="IFCBUILDING">Building</SelectItem>
                <SelectItem value="IFCBUILDINGSTOREY">
                  Building Storey
                </SelectItem>
                <SelectItem value="IFCSPACE">Space</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Select which type of spatial element to output
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Spatial Elements</div>
            <div className="text-xs text-muted-foreground">
              Connect an IFC file to the node to select specific spatial
              elements
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-center text-sm text-muted-foreground py-4">
          No properties available for this node type.
        </div>
      );
  }
}

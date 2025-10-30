"use client";

import { memo } from "react";
import { type NodeProps } from "reactflow";
import { Edit, List, FileSearch, AlertTriangle } from "lucide-react";
import { PropertyNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";
// Define proper types for the component
interface PropertyInfo {
  name: string;
  exists: boolean;
  value: any;
  psetName: string;
}

interface PropertyNodeElement {
  id: string;
  type: string;
  propertyInfo?: PropertyInfo;
  [key: string]: any;
}

// Note: PropertyNode now uses BaseNode, but handles are managed by BaseNode

export const PropertyNode = memo(
  (props: NodeProps<PropertyNodeData>) => {
    const { data } = props;
    const { properties, label = "Property Node" } = data;
    // PropertyNodeData may have results at runtime even if not in type
    const nodeData = data as PropertyNodeData & { results?: PropertyNodeElement[] };

    // Extract property information from component data
    // This handles both formats: "IsExternal", "Pset_WallCommon:IsExternal", and "MyCustomPset.PropertyName"
    const rawPropertyName = properties?.propertyName || "";
    let propertyName = rawPropertyName;
    let explicitPset = "";

    // Check if property name includes the Pset prefix (colon notation: "Pset_WallCommon:IsExternal")
    if (rawPropertyName.includes(":")) {
      const parts = rawPropertyName.split(":");
      explicitPset = parts[0];
      propertyName = parts[1];
    }
    // Check if property name includes dot notation (e.g., "MyCustomPset.PropertyName")
    else if (rawPropertyName.includes(".")) {
      const parts = rawPropertyName.split(".");
      if (parts.length === 2) {
        explicitPset = parts[0];
        propertyName = parts[1];
      }
    }

    const action = properties?.action || "Get";
    const propertyValue = properties?.propertyValue || "";
    const targetPset =
      properties?.targetPset || explicitPset || "CustomProperties";

    // Helper to format the property value for display
    const formatPropertyValue = (value: any): string => {
      if (value === undefined || value === null) return "";
      if (typeof value === "boolean") return value ? "true" : "false";
      if (typeof value === "object")
        return JSON.stringify(value).substring(0, 20) + "...";
      return String(value);
    };

    // Helper to get count of elements with property
    const getElementsWithPropertyCount = (): string => {
      if (!nodeData.results) return "0 of 0 elements";

      const withProperty = nodeData.results.filter(
        (e) => e.propertyInfo?.exists
      ).length;
      return `${withProperty} of ${nodeData.results.length} elements`;
    };

    // Prepare output data for watch node in a more concise format
    const getOutputData = () => {
      if (!nodeData.results || action.toLowerCase() !== "get") return nodeData.results;

      if (nodeData.results.length === 0)
        return { message: "No elements processed" };

      // Extract the property results
      const elementsWithProperty = nodeData.results.filter(
        (e) => e.propertyInfo?.exists
      );

      if (elementsWithProperty.length === 0) {
        return {
          propertyName,
          found: false,
          message: `Property "${propertyName}" not found in any elements`,
        };
      }

      // Get unique values
      const values = elementsWithProperty.map((e) => e.propertyInfo?.value);
      const uniqueValues = [
        ...new Set(
          values.map((v) =>
            typeof v === "object" ? JSON.stringify(v) : String(v)
          )
        ),
      ].map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });

      // Create a concise result object
      return {
        propertyName,
        targetPset: targetPset !== "any" ? targetPset : null,
        found: true,
        count: {
          total: nodeData.results.length,
          withProperty: elementsWithProperty.length,
        },
        foundIn: [
          ...new Set(elementsWithProperty.map((e) => e.propertyInfo?.psetName)),
        ],
        type: typeof elementsWithProperty[0]?.propertyInfo?.value,
        uniqueValues,
        // Include a sample of elements with their values for reference
        samples: elementsWithProperty.slice(0, 3).map((e) => ({
          id: e.id,
          type: e.type,
          value: e.propertyInfo?.value,
        })),
      };
    };

    // Show property info for a Get operation with results
    const renderPropertyResults = () => {
      if (!nodeData.results || action.toLowerCase() !== "get") return null;

      // Count elements with the property
      const elementsWithProperty = nodeData.results.filter(
        (e) => e.propertyInfo?.exists
      );

      // Find all different property sets that contain this property
      const psetCounts: Record<string, number> = {};
      elementsWithProperty.forEach((element) => {
        const psetName = element.propertyInfo?.psetName || "";
        psetCounts[psetName] = (psetCounts[psetName] || 0) + 1;
      });

      // Find all different values and their types
      const valueTypes: Record<string, number> = {};
      const uniqueValues = new Set<string>();
      elementsWithProperty.forEach((element) => {
        if (element.propertyInfo?.exists) {
          const value = element.propertyInfo.value;
          const type = typeof value;
          valueTypes[type] = (valueTypes[type] || 0) + 1;

          // Track unique values (as strings)
          uniqueValues.add(formatPropertyValue(value));
        }
      });

      // Get a sample value if available
      const sampleValue =
        elementsWithProperty.length > 0
          ? formatPropertyValue(elementsWithProperty[0].propertyInfo?.value)
          : "";

      return (
        <div className="mt-2 pt-1 border-t border-gray-200">
          <div className="flex items-center gap-1 text-blue-600 font-medium">
            <FileSearch className="h-3 w-3" />
            <span>Results</span>
          </div>

          <div className="text-xs text-gray-600">
            {getElementsWithPropertyCount()}
          </div>

          {elementsWithProperty.length > 0 && (
            <>
              {/* Show property sets this appears in */}
              {Object.keys(psetCounts).length > 0 && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Found in: </span>
                  <span className="text-xs font-medium truncate">
                    {Object.keys(psetCounts).join(", ")}
                  </span>
                </div>
              )}

              {/* Show value types */}
              {Object.keys(valueTypes).length > 0 && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Types: </span>
                  <span className="text-xs font-medium">
                    {Object.entries(valueTypes)
                      .map(([type, count]) => `${type}(${count})`)
                      .join(", ")}
                  </span>
                </div>
              )}

              {/* Show unique values if there aren't too many */}
              {uniqueValues.size > 0 && uniqueValues.size <= 3 && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Values: </span>
                  <span className="text-xs font-medium">
                    {Array.from(uniqueValues).join(", ")}
                  </span>
                </div>
              )}

              {/* Show sample value */}
              {sampleValue && uniqueValues.size > 3 && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Sample: </span>
                  <span className="font-medium">{sampleValue}</span>
                </div>
              )}
            </>
          )}
        </div>
      );
    };

    // Helper to display complete property name with Pset if available
    const getDisplayPropertyName = () => {
      if (explicitPset) {
        // Use dot notation for display since it's more intuitive
        return `${explicitPset}.${propertyName}`;
      }
      return propertyName;
    };

    return (
      <BaseNode
        {...props}
        isLoading={(nodeData as any).isLoading || false}
        error={(nodeData as any).error || null}
        showStatusIcon={true}
        theme={nodeThemes.property}
      >
        <div className="p-3 text-xs">
          {propertyName ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Action:</span>
                <span className="font-medium">{action}</span>
              </div>
              <div className="flex justify-between">
                <span>Property:</span>
                <span className="font-medium truncate max-w-24">
                  {getDisplayPropertyName()}
                </span>
              </div>

              {/* Show target pset for all operations */}
              <div className="flex justify-between">
                <span>Pset:</span>
                <span className="font-medium truncate max-w-24">
                  {targetPset === "any" ? "Any" : targetPset}
                </span>
              </div>

              {/* Show value for set/add operations */}
              {(action.toLowerCase() === "set" ||
                action.toLowerCase() === "add") && (
                  <div className="flex justify-between">
                    <span>Value:</span>
                    <span className="font-medium truncate max-w-24">
                      {properties?.useValueInput
                        ? "From Input"
                        : formatPropertyValue(propertyValue)}
                    </span>
                  </div>
                )}

              {/* Warning if no results found */}
              {nodeData.results &&
                nodeData.results.length > 0 &&
                nodeData.results.filter((e) => e.propertyInfo?.exists).length ===
                0 &&
                action.toLowerCase() === "get" && (
                  <div className="mt-2 pt-1 border-t border-gray-200 text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-xs">
                      Property not found in any element
                    </span>
                  </div>
                )}

              {/* Results display */}
              {renderPropertyResults()}

              {properties?.useValueInput && (
                <div className="text-xs text-blue-500 mt-1">
                  Using value from input
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground">No property configured</div>
          )}
        </div>
      </BaseNode>
    );
  }
);

PropertyNode.displayName = "PropertyNode";

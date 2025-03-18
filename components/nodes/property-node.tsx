"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Edit, List, FileSearch, AlertTriangle } from "lucide-react";

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

interface PropertyNodeProps {
  data: {
    label?: string;
    properties?: {
      propertyName?: string;
      action?: string;
      propertyValue?: string;
      targetPset?: string;
      useValueInput?: boolean;
    };
    results?: PropertyNodeElement[];
  };
  isConnectable?: boolean;
}

export const PropertyNode = memo(
  ({ data, isConnectable }: PropertyNodeProps) => {
    const { properties, label = "Property Node" } = data;

    // Extract property information from component data
    // This handles both formats: "IsExternal" and "Pset_WallCommon:IsExternal"
    const rawPropertyName = properties?.propertyName || "";
    let propertyName = rawPropertyName;
    let explicitPset = "";

    // Check if property name includes the Pset prefix (e.g., "Pset_WallCommon:IsExternal")
    if (rawPropertyName.includes(":")) {
      const parts = rawPropertyName.split(":");
      explicitPset = parts[0];
      propertyName = parts[1];
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
      if (!data.results) return "0 of 0 elements";

      const withProperty = data.results.filter(
        (e) => e.propertyInfo?.exists
      ).length;
      return `${withProperty} of ${data.results.length} elements`;
    };

    // Prepare output data for watch node in a more concise format
    const getOutputData = () => {
      if (!data.results || action.toLowerCase() !== "get") return data.results;

      if (data.results.length === 0)
        return { message: "No elements processed" };

      // Extract the property results
      const elementsWithProperty = data.results.filter(
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
          total: data.results.length,
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
      if (!data.results || action.toLowerCase() !== "get") return null;

      // Count elements with the property
      const elementsWithProperty = data.results.filter(
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
        return `${explicitPset}:${propertyName}`;
      }
      return propertyName;
    };

    return (
      <div className="bg-white border-2 border-pink-500 rounded-md w-48 shadow-md">
        <div className="bg-pink-500 text-white px-3 py-1 flex items-center gap-2">
          <Edit className="h-4 w-4" />
          <div className="text-sm font-medium truncate">{label}</div>
        </div>
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
              {data.results &&
                data.results.length > 0 &&
                data.results.filter((e) => e.propertyInfo?.exists).length ===
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
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
        {/* Second input for property values */}
        {properties?.useValueInput &&
          (action.toLowerCase() === "set" ||
            action.toLowerCase() === "add") && (
            <Handle
              type="target"
              position={Position.Top}
              id="valueInput"
              style={{ background: "#7c3aed", width: 8, height: 8 }}
              isConnectable={isConnectable}
            />
          )}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
          // Add data attribute to pass the processed output
          data-output={JSON.stringify(getOutputData())}
        />
      </div>
    );
  }
);

PropertyNode.displayName = "PropertyNode";

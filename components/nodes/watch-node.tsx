"use client";

import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import {
  FileText,
  Table,
  Code,
  BarChart2,
  Copy,
  Check,
  Database,
} from "lucide-react";
import { formatPropertyValue } from "@/lib/ifc/property-utils";

// Define proper types
interface WatchNodeProps {
  data: {
    label?: string;
    properties?: {
      displayMode?: "table" | "raw" | "summary";
      autoUpdate?: boolean;
    };
    inputData?: {
      type: string;
      value: any;
      count?: number;
    };
  };
  isConnectable?: boolean;
}

export const WatchNode = memo(({ data, isConnectable }: WatchNodeProps) => {
  // Track copy status for button feedback
  const [copied, setCopied] = useState(false);

  // Get real data from input connections or empty data if none available
  const inputData = data.inputData || { type: "unknown", value: undefined };
  const displayMode = data.properties?.displayMode || "table";

  // Copy data to clipboard
  const copyToClipboard = () => {
    if (!inputData.value) return;

    const jsonString = JSON.stringify(inputData.value, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  // Helper functions for data visualization
  const isIfcElementArray = (value: any): boolean => {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] &&
      typeof value[0] === "object" &&
      ("type" in value[0] || "expressId" in value[0])
    );
  };

  const renderElementCount = () => {
    if (!inputData.value || !Array.isArray(inputData.value)) return null;

    // Extract element type counts
    const typeCounts: Record<string, number> = {};
    inputData.value.forEach((element) => {
      if (element.type) {
        typeCounts[element.type] = (typeCounts[element.type] || 0) + 1;
      }
    });

    return (
      <div className="mt-1 text-xs">
        <div className="flex items-center gap-1 text-blue-600 mb-1">
          <BarChart2 className="h-3 w-3" />
          <span>Element Count</span>
        </div>
        <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="flex justify-between">
              <span className="truncate">{type.replace("Ifc", "")}:</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
          <div className="flex justify-between col-span-2 border-t border-gray-200 mt-0.5 pt-0.5">
            <span>Total:</span>
            <span className="font-medium">{inputData.value.length}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderPropertyResults = () => {
    // Check if we have property results with elements
    if (
      inputData.type === "propertyResults" &&
      inputData.value &&
      inputData.value.elements &&
      Array.isArray(inputData.value.elements)
    ) {
      return (
        <div className="space-y-2">
          {/* Property info header */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">
                {inputData.value.propertyName}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                {inputData.value.psetName}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {inputData.value.elementsWithProperty} of{" "}
              {inputData.value.totalElements} elements
            </div>

            {/* Unique values */}
            <div className="flex mt-1 gap-1 flex-wrap">
              {inputData.value.uniqueValues.map((value: any, i: number) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded bg-gray-100 flex items-center"
                >
                  {typeof value === "boolean"
                    ? value
                      ? "✓ true"
                      : "✗ false"
                    : String(value)}
                </span>
              ))}
            </div>
          </div>

          {/* Display element references with GlobalIds */}
          <div className="overflow-auto max-h-32 mt-1">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1 text-left">Element</th>
                  <th className="p-1 text-left">GlobalId</th>
                  <th className="p-1 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {inputData.value.elements
                  .slice(0, 5)
                  .map((element: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-1 border-t border-gray-200">
                        {element.type.replace("Ifc", "")}{" "}
                        {element.Name ? `(${element.Name})` : element.id}
                      </td>
                      <td className="p-1 border-t border-gray-200 font-mono text-xs">
                        {element.GlobalId || "—"}
                      </td>
                      <td className="p-1 border-t border-gray-200">
                        {formatPropertyValue(element.value, { maxLength: 20 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {inputData.value.elements.length > 5 && (
              <div className="text-xs text-gray-500 mt-1 px-1">
                ... and {inputData.value.elements.length - 5} more elements
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderData = () => {
    // Return empty state message if no data
    if (!inputData.value) {
      return (
        <div className="text-center text-xs text-muted-foreground py-2">
          Connect an input to see data
        </div>
      );
    }

    // Handle IFC element arrays differently
    if (isIfcElementArray(inputData.value)) {
      if (displayMode === "summary") {
        return renderElementCount();
      } else if (displayMode === "raw") {
        // Sample of first few elements for raw view
        const sampleSize = Math.min(inputData.value.length, 3);
        const sample = inputData.value.slice(0, sampleSize);
        return (
          <div className="space-y-1">
            <div className="flex justify-end">
              <button
                onClick={copyToClipboard}
                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                title="Copy full JSON to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="bg-gray-50 p-1 rounded text-xs font-mono overflow-auto max-h-32">
              {JSON.stringify(sample, null, 2)}
              {sampleSize < inputData.value.length && (
                <div className="text-gray-500 mt-1">
                  ... and {inputData.value.length - sampleSize} more elements
                </div>
              )}
            </div>
          </div>
        );
      }
    }

    // Raw JSON view
    if (displayMode === "raw") {
      return (
        <div className="space-y-1">
          <div className="flex justify-end">
            <button
              onClick={copyToClipboard}
              className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
              title="Copy JSON to clipboard"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="bg-gray-50 p-1 rounded text-xs font-mono overflow-auto max-h-32">
            {JSON.stringify(inputData.value, null, 2)}
          </div>
        </div>
      );
    }

    // Special handling for property results
    if (inputData.type === "propertyResults") {
      return renderPropertyResults();
    }

    // Table view for objects
    else if (
      displayMode === "table" &&
      typeof inputData.value === "object" &&
      inputData.value !== null
    ) {
      // For IFC Element arrays, show different table
      if (isIfcElementArray(inputData.value)) {
        const elements = inputData.value.slice(0, 5); // First 5 elements

        return (
          <div className="space-y-1">
            {displayMode === "raw" && (
              <div className="flex justify-end">
                <button
                  onClick={copyToClipboard}
                  className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                  title="Copy full JSON to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
            <div className="overflow-auto max-h-32">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 text-left">ID</th>
                    <th className="p-1 text-left">Type</th>
                    <th className="p-1 text-left">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((element: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-1 border-t border-gray-200">
                        {element.expressId || element.id}
                      </td>
                      <td className="p-1 border-t border-gray-200">
                        {element.type}
                      </td>
                      <td className="p-1 border-t border-gray-200 truncate max-w-16">
                        {element.properties?.Name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {inputData.value.length > 5 && (
                <div className="text-xs text-gray-500 mt-1 px-1">
                  ... and {inputData.value.length - 5} more elements
                </div>
              )}
            </div>
          </div>
        );
      }

      // Regular object table view
      return (
        <div className="space-y-1">
          {displayMode === "raw" && (
            <div className="flex justify-end">
              <button
                onClick={copyToClipboard}
                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                title="Copy object as JSON"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
          <div className="overflow-auto max-h-32">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-1 text-left">Key</th>
                  <th className="p-1 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(inputData.value).map(([key, value], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="p-1 border-t border-gray-200">{key}</td>
                    <td className="p-1 border-t border-gray-200 truncate max-w-24">
                      {formatPropertyValue(value, { maxLength: 30 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    // Single value display
    else if (typeof inputData.value !== "object") {
      return (
        <div className="space-y-1">
          {displayMode === "raw" && (
            <div className="flex justify-end">
              <button
                onClick={copyToClipboard}
                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                title="Copy value"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
          <div className="bg-gray-50 p-2 rounded text-sm">
            {String(inputData.value)}
          </div>
        </div>
      );
    }
    // Fallback for unknown data types
    else {
      return (
        <div className="text-center text-xs py-2">
          Unable to display this data type. Try changing the display mode.
        </div>
      );
    }
  };

  // Display mode indicator
  const getDisplayModeIcon = () => {
    switch (displayMode) {
      case "raw":
        return <Code className="h-3 w-3" />;
      case "summary":
        return <BarChart2 className="h-3 w-3" />;
      case "table":
      default:
        return <Table className="h-3 w-3" />;
    }
  };

  return (
    <div className="bg-white border-2 border-teal-500 rounded-md w-64 shadow-md">
      <div className="bg-teal-500 text-white px-3 py-1 flex items-center gap-2">
        <Database className="h-4 w-4" />
        <div className="text-sm font-medium truncate">
          {data.label || "Watch Node"}
        </div>
      </div>
      <div className="p-3">
        <div className="text-xs mb-1 flex justify-between">
          <span className="flex items-center gap-1">
            {getDisplayModeIcon()}
            <span>
              {displayMode === "raw"
                ? "JSON"
                : displayMode === "summary"
                ? "Summary"
                : "Table"}
            </span>
          </span>
          <span className="text-muted-foreground">
            {inputData.type === "array"
              ? `${inputData.count || 0} items`
              : inputData.type !== "unknown"
              ? inputData.type
              : "No data"}
          </span>
        </div>
        {renderData()}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

WatchNode.displayName = "WatchNode";

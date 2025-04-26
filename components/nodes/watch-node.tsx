"use client";

import { memo, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
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
import React from "react";

// Define proper types
interface WatchNodeData {
  label?: string;
  properties?: {
    displayMode?: string;
  };
  inputData?: {
    type: string;
    value: any;
    count?: number;
  };
  width?: number;
  height?: number;
}

type WatchNodeProps = NodeProps<WatchNodeData>;

export const WatchNode = memo(
  ({ data, id, selected, isConnectable }: WatchNodeProps) => {
    // Track copy status for button feedback
    const [copied, setCopied] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const { setNodes } = useReactFlow();

    // Counter state to force re-renders
    const [updateCounter, setUpdateCounter] = useState(0);
    const prevInputDataRef = useRef<any>(null);
    const keyRef = useRef<string>(`watch-${id}-${Date.now()}`);

    // Effect to detect actual data changes and force updates
    useEffect(() => {
      if (!data.inputData) return;

      const currentInputData = data.inputData;
      const prevInputData = prevInputDataRef.current;

      // Do a deep comparison of the input data
      const hasChanged = () => {
        if (!prevInputData) return true;

        // Compare type changes
        if (prevInputData.type !== currentInputData.type) return true;

        // Compare value changes based on type
        if (currentInputData.type === "quantityResults") {
          // For quantity results, compare groups and total
          const prevValue = prevInputData.value || {};
          const currentValue = currentInputData.value || {};

          // Check if groups, unit or total has changed
          if (prevValue.unit !== currentValue.unit) return true;
          if (prevValue.total !== currentValue.total) return true;

          // Compare group counts
          const prevGroups = prevValue.groups || {};
          const currentGroups = currentValue.groups || {};

          // Check if groups have changed
          const prevGroupKeys = Object.keys(prevGroups);
          const currentGroupKeys = Object.keys(currentGroups);

          if (prevGroupKeys.length !== currentGroupKeys.length) return true;

          for (const key of currentGroupKeys) {
            if (prevGroups[key] !== currentGroups[key]) return true;
          }
        } else {
          // For other types, do a basic comparison
          if (JSON.stringify(prevInputData.value) !== JSON.stringify(currentInputData.value)) {
            return true;
          }
        }

        return false;
      };

      // If data has changed, update the component
      if (hasChanged()) {
        // Store the new data
        prevInputDataRef.current = JSON.parse(JSON.stringify(currentInputData));

        // Generate a new key to force remounting
        keyRef.current = `watch-${id}-${Date.now()}`;

        // Use both React state and DOM updates to ensure rendering
        setUpdateCounter(prev => prev + 1);

        // Schedule another update with requestAnimationFrame to ensure rendering
        window.requestAnimationFrame(() => {
          setUpdateCounter(prev => prev + 1);
        });
      }
    }, [data.inputData, id]);

    // Safe conversion to React nodes - handles all unknown types safely
    const toDisplayableContent = (value: unknown): React.ReactNode => {
      if (value === null) return <span className="text-gray-400">null</span>;
      if (value === undefined) return <span className="text-gray-400">undefined</span>;

      if (typeof value === 'object') {
        // Safe handling for objects and arrays
        try {
          return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
        } catch (err) {
          return '[Complex Object]';
        }
      }

      // Primitives are safe to display directly
      return String(value);
    };

    // Default sizes with fallback values
    const width = data.width || 250;
    const height = data.height || 200;
    const contentHeight = Math.max(height - 80, 80); // Subtract header and footer space

    // Get real data from input connections or empty data if none available
    const inputData = data.inputData || { type: "unknown", value: undefined };
    const displayMode = data.properties?.displayMode || "table";

    // Debug output - comment out in production
    console.log(`Rendering WatchNode ${id}, key: ${keyRef.current}, counter: ${updateCounter}, data:`,
      inputData.type, inputData.value ? (typeof inputData.value === 'object' ? Object.keys(inputData.value).length : inputData.value) : 'undefined');

    // Handle window mouse events for resizing
    const startResize = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const onMouseMove = (e: MouseEvent) => {
          const newWidth = Math.max(200, startWidth + e.clientX - startX);
          const newHeight = Math.max(150, startHeight + e.clientY - startY);

          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    width: newWidth,
                    height: newHeight,
                  },
                };
              }
              return node;
            })
          );
        };

        const onMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      },
      [id, width, height, setNodes]
    );

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
            <div
              className="overflow-auto"
              style={{ maxHeight: `${contentHeight - 50}px` }}
            >
              <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:text-gray-900">
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
                      <tr key={i} className={`${i % 2 === 0 ? 'bg-gray-50 dark:text-gray-900' : ''}`}>
                        <td className="p-1 border-t border-gray-200">
                          {element.type.replace("Ifc", "")}{" "}
                          {element.Name ? `(${element.Name})` : element.id}
                        </td>
                        <td className="p-1 border-t border-gray-200 font-mono text-xs">
                          {element.GlobalId || "—"}
                        </td>
                        <td className="p-1 border-t border-gray-200">
                          {formatPropertyValue(element.value, {
                            maxLength: 20,
                          })}
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

    // NEW FUNCTION: Render Quantity Results
    const renderQuantityResults = (): JSX.Element | null => {
      if (inputData.type !== "quantityResults" || !inputData.value) {
        return null;
      }

      // Destructure correctly
      const { groups, unit, total, error } = inputData.value as QuantityResults & { error?: string };
      const groupEntries = Object.entries(groups || {});

      // Handle error case with visual indicator
      if (error) {
        return (
          <div className="space-y-2">
            <div className="text-xs mb-1 flex justify-between">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                <span>Quantity Results</span>
              </span>
            </div>
            <div className="bg-red-50 dark:bg-red-900 p-2 rounded-md border border-red-200 dark:border-red-700">
              <div className="text-red-600 dark:text-red-400 text-xs font-medium">
                {error}
              </div>
              <div className="text-xs text-red-500 mt-1">
                Try loading an IFC file first or checking connections.
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <div className="text-xs mb-1 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Quantity Results</span>
            </span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:text-gray-900">
                <tr>
                  <th className="p-1 text-left">Group</th>
                  <th className="p-1 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {groupEntries.map(([key, value], i: number) => (
                  <tr key={i} className={`${i % 2 === 0 ? 'bg-gray-50 dark:text-gray-900' : ''}`}>
                    <td className="p-1 border-t border-gray-200">{key}</td>
                    <td className="p-1 border-t border-gray-200">
                      {Number(value).toFixed(2)} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-medium">
                  <td className="p-1">Total</td>
                  <td className="p-1">
                    {Number(total).toFixed(2)} {unit}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    };

    // Render the data content based on input type and display mode
    const renderData = (): JSX.Element | null => {
      if (!inputData.value) {
        return (
          <div className="text-xs text-gray-400 flex items-center justify-center h-full italic">
            No data available
          </div>
        );
      }

      // Special handling for property results
      if (inputData.type === "propertyResults") {
        return renderPropertyResults();
      }

      // Special handling for quantity results
      if (inputData.type === "quantityResults" && displayMode !== "raw") {
        return renderQuantityResults();
      }

      // Table view (default)
      if (displayMode === "table" || displayMode === ("default" as string)) {
        // Handle array inputs
        if (Array.isArray(inputData.value)) {
          // For elements with type property, create a summary table
          if (
            inputData.value.length > 0 &&
            inputData.value[0].type &&
            typeof inputData.value[0].type === "string"
          ) {
            return (
              <div
                key={`${keyRef.current}-table`}
                className="space-y-1"
              >
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:text-gray-900">
                      <tr>
                        <th className="p-1 text-left">Type</th>
                        <th className="p-1 text-left">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        inputData.value.reduce(
                          (acc, item) => {
                            const type = item.type;
                            acc[type] = (acc[type] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        )
                      ).map(([type, count], i: number) => (
                        <tr
                          key={i}
                          className={`${i % 2 === 0 ? "bg-gray-50 dark:text-gray-900" : ""
                            }`}
                        >
                          <td className="p-1 border-t border-gray-200">
                            {type}
                          </td>
                          <td className="p-1 border-t border-gray-200">
                            {count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-medium">
                        <td className="p-1">Total</td>
                        <td className="p-1">{inputData.value.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          } else {
            // For generic arrays, list the items
            return (
              <div
                key={`${keyRef.current}-array`}
                className="overflow-auto text-xs"
                style={{ maxHeight: `${contentHeight}px` }}
              >
                <div className="mb-1 text-xs font-medium">
                  Array ({inputData.value.length} items)
                </div>
                <ul className="list-disc list-inside">
                  {inputData.value.map((item, i) => (
                    <li key={i} className="mb-1">
                      {toDisplayableContent(item)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
        }

        // For objects, create a property table
        if (typeof inputData.value === "object") {
          return (
            <div
              key={`${keyRef.current}-object`}
              className="overflow-auto"
            >
              <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:text-gray-900">
                  <tr>
                    <th className="p-1 text-left">Property</th>
                    <th className="p-1 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(inputData.value).map(([key, value], i) => (
                    <tr
                      key={key}
                      className={`${i % 2 === 0 ? "bg-gray-50 dark:text-gray-900" : ""
                        }`}
                    >
                      <td className="p-1 border-t border-gray-200">{key}</td>
                      <td className="p-1 border-t border-gray-200">
                        {toDisplayableContent(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // For primitives, just display the value
        return (
          <div
            key={`${keyRef.current}-primitive`}
            className="text-xs"
          >
            <div className="mb-1 font-medium">
              {typeof inputData.value} value:
            </div>
            <div className="bg-gray-50 dark:text-gray-900 p-1 rounded">
              {toDisplayableContent(inputData.value)}
            </div>
          </div>
        );
      }

      // Raw JSON view
      if (displayMode === ("raw" as string)) {
        // Format JSON properly
        const formattedJson = (() => {
          try {
            return JSON.stringify(inputData.value, null, 2);
          } catch (err) {
            return "Error formatting JSON: Object contains circular references or is not serializable";
          }
        })();

        return (
          <div
            key={`${keyRef.current}-raw`}
            className="space-y-1"
          >
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
            <div
              className="bg-gray-50 dark:text-gray-900 p-1 rounded text-xs font-mono overflow-auto"
              style={{ maxHeight: `${contentHeight - 30}px` }}
            >
              {formattedJson}
            </div>
          </div>
        );
      }

      // Special handling for property results
      if (inputData.type === "propertyResults") {
        return renderPropertyResults();
      }

      // Special handling for quantity results
      if (inputData.type === "quantityResults" && displayMode !== "raw") {
        return renderQuantityResults();
      }

      return null;
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
      <div
        key={keyRef.current}
        className={`bg-white dark:bg-gray-800 border-2 ${selected ? "border-teal-600 dark:border-teal-400" : "border-teal-500 dark:border-teal-400"
          } rounded-md shadow-md relative overflow-hidden ${isResizing ? "nodrag" : ""
          }`}
        style={{ width: `${width}px` }}
        data-nodrag={isResizing ? "true" : undefined}
        data-watch-counter={updateCounter}
      >
        <div className="bg-teal-500 text-white px-3 py-1 flex items-center gap-2 nodrag-handle">
          <Database className="h-4 w-4" />
          <div className="text-sm font-medium truncate">
            {data.label || "Results Viewer"}
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
          <div
            style={{ height: `${contentHeight}px` }}
            className="overflow-auto"
          >
            {renderData()}
          </div>
        </div>

        {/* Resize handle - nodrag class prevents ReactFlow drag */}
        <div
          className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize nodrag ${selected ? "text-teal-600" : "text-gray-400"
            } hover:text-teal-500`}
          onMouseDown={startResize}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 2L2 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M22 10L10 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M22 18L18 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
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
  }
);

WatchNode.displayName = "WatchNode";

// Define QuantityResults interface (might need to move to a shared types file)
interface QuantityResults {
  groups: Record<string, number>;
  unit: string;
  total: number;
}

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
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

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

// Define interfaces for different analysis result types
interface QuantityResults {
  groups: Record<string, number>;
  unit: string;
  total: number;
  groupBy?: string;
  error?: string;
}

interface RoomAssignmentResults {
  elementSpaceMap: Record<string, {
    spaceId: string;
    spaceName: string;
    spaceType: string;
    storey?: string;
  }>;
  spaceElementsMap: Record<string, {
    name: string;
    type: string;
    description: string;
    longName: string;
    elements: Array<{
      id: string;
      type: string;
      name: string;
    }>;
    properties: Record<string, any>;
    quantities: Record<string, number>;
  }>;
  zones: Record<string, {
    name: string;
    description: string;
    spaces: Array<{ id: string; name: string }>;
    type: string;
  }>;
  summary: {
    totalSpaces: number;
    totalZones: number;
    assignedElements: number;
    unassignedElements: number;
    spaces: Array<{ id: string; name: string }>;
  };
}

interface SpaceMetricsResults {
  spaces: Record<string, {
    name: string;
    type: string;
    area: number;
    volume: number;
    height: number;
    occupancy: number;
    elementCount: number;
  }>;
  totals: {
    totalArea: number;
    totalVolume: number;
    totalOccupancy: number;
    averageArea: number;
    spaceCount: number;
  };
}

interface CirculationResults {
  circulationArea: number;
  programArea: number;
  totalArea: number;
  circulationRatio: number;
  circulationSpaces: number;
  programSpaces: number;
  details: {
    circulation: Array<{ id: string; name: string; type: string }>;
    program: Array<{ id: string; name: string; type: string }>;
  };
}

interface OccupancyResults {
  spaces: Array<{
    spaceId: string;
    spaceName: string;
    spaceType: string;
    area: number;
    occupancy: number;
    occupancyFactor: number;
  }>;
  summary: {
    totalOccupancy: number;
    totalArea: number;
    averageOccupancyDensity: number;
    spaceCount: number;
  };
}

type WatchNodeProps = NodeProps<WatchNodeData>;

export const WatchNode = memo(
  ({ data, id, selected, isConnectable }: WatchNodeProps) => {
    // Colors for pie chart - updated for better contrast and distinction
    const COLORS = [
      '#0088FE', // bright blue
      '#FF8042', // bright orange
      '#00C49F', // teal
      '#FFBB28', // yellow
      '#9370DB', // medium purple
      '#FF6B6B', // coral red
      '#4CAF50', // green
      '#F44336', // red
      '#3F51B5', // indigo
      '#9C27B0', // purple
      '#009688', // teal
      '#FFC107', // amber
    ];

    // Track copy status for button feedback
    const [copied, setCopied] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const { setNodes } = useReactFlow();

    // Counter state to force re-renders
    const [updateCounter, setUpdateCounter] = useState(0);
    const prevInputDataRef = useRef<any>(null);
    const keyRef = useRef<string>(`watch-${id}-${Date.now()}`);

    // For tracking display mode - extracted from properties for easier access
    const [localDisplayMode, setLocalDisplayMode] = useState(data.properties?.displayMode || "table");

    // Update local display mode when node properties change
    useEffect(() => {
      setLocalDisplayMode(data.properties?.displayMode || "table");
    }, [data.properties?.displayMode]);

    // Keyboard handler for display mode toggling
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
      // Only respond if this node is selected
      if (!selected) return;

      if (e.key === 'd' || e.key === 'D') {
        // Cycle through display modes: table -> chart -> raw -> table
        const modes = ["table", "chart", "raw"];
        const currentIndex = modes.indexOf(localDisplayMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        const newMode = modes[nextIndex];

        // Update local state
        setLocalDisplayMode(newMode);

        // Update node data
        setNodes(nodes =>
          nodes.map(node => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  properties: {
                    ...node.data.properties,
                    displayMode: newMode
                  }
                }
              };
            }
            return node;
          })
        );

        // Show a brief tooltip or toast
        console.log(`Watch node display mode changed to: ${newMode}`);
      }
    }, [id, selected, localDisplayMode, setNodes]);

    // Register and clean up keyboard event listener
    useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [handleKeyDown]);

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
    // Use the local display mode for rendering
    const displayMode = localDisplayMode || data.properties?.displayMode || "table";

    // Debug output - comment out in production
    console.log(`Rendering WatchNode ${id}, key: ${keyRef.current}, counter: ${updateCounter}, mode: ${displayMode}, data:`,
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

    // Render room assignment results
    const renderRoomAssignmentResults = (): JSX.Element | null => {
      if (inputData.type !== "roomAssignment" || !inputData.value) {
        return null;
      }

      const data = inputData.value as RoomAssignmentResults;
      const { elementSpaceMap, spaceElementsMap, zones, summary } = data;

      if (displayMode === "chart") {
        // Show zones if available, otherwise show element distribution by space
        if (Object.keys(zones).length > 0) {
          // Zone-based visualization
          const zoneData = Object.entries(zones).map(([zoneId, zone], index) => ({
            name: zone.name.length > 20 ? `${zone.name.substring(0, 20)}...` : zone.name,
            value: zone.spaces.length,
            fill: COLORS[index % COLORS.length],
            fullName: zone.name,
            type: zone.type
          }));

          return (
            <div className="space-y-3">
              <div className="text-xs mb-1 flex justify-between">
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  <span>Zones & Their Spaces</span>
                </span>
                <span>{Object.keys(zones).length} zones</span>
              </div>
              <div style={{ width: '100%', height: Math.min(contentHeight - 50, 220) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      innerRadius={30}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => percent >= 0.08 ? name : null}
                    >
                      {zoneData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${value} spaces`,
                        props.payload.fullName
                      ]}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: 'inherit' }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        } else {
          // Element distribution by top spaces (bar chart style)
          const spaceElementCounts = Object.entries(spaceElementsMap)
            .map(([spaceId, space]) => ({
              name: space.name.length > 15 ? `${space.name.substring(0, 15)}...` : space.name,
              elements: space.elements.length,
              fullName: space.name,
              type: space.type
            }))
            .sort((a, b) => b.elements - a.elements)
            .slice(0, 8); // Top 8 spaces

          return (
            <div className="space-y-3">
              <div className="text-xs mb-1 flex justify-between">
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  <span>Elements per Space (Top 8)</span>
                </span>
              </div>
              <div className="space-y-1.5">
                {spaceElementCounts.map((space, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="truncate max-w-[120px]" title={space.fullName}>
                        {space.name}
                      </span>
                      <span className="font-medium">{space.elements} elements</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full`}
                        style={{
                          width: `${Math.max(5, (space.elements / Math.max(...spaceElementCounts.map(s => s.elements))) * 100)}%`,
                          backgroundColor: COLORS[i % COLORS.length]
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      }

      return (
        <div className="space-y-3">
          <div className="text-xs mb-2 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Room Assignment Results</span>
            </span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 dark:bg-blue-900 p-2 rounded">
              <div className="font-medium text-blue-800 dark:text-blue-200">Spaces</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-300">{summary.totalSpaces}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 p-2 rounded">
              <div className="font-medium text-green-800 dark:text-green-200">Assigned Elements</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-300">{summary.assignedElements}</div>
            </div>
          </div>

          {/* Spaces table */}
          <div className="overflow-auto" style={{ maxHeight: `${contentHeight - 120}px` }}>
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="p-1 text-left">Space</th>
                  <th className="p-1 text-left">Type</th>
                  <th className="p-1 text-right">Elements</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(spaceElementsMap).slice(0, 20).map(([spaceId, space], i) => (
                  <tr key={spaceId} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 truncate max-w-[100px]" title={space.name}>
                      {space.name}
                    </td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600">{space.type}</td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">{space.elements.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(spaceElementsMap).length > 20 && (
              <div className="text-xs text-gray-500 mt-1 px-1">
                ... and {Object.keys(spaceElementsMap).length - 20} more spaces
              </div>
            )}
          </div>
        </div>
      );
    };

    // Render space metrics results
    const renderSpaceMetricsResults = (): JSX.Element | null => {
      if (inputData.type !== "spaceMetrics" || !inputData.value) {
        return null;
      }

      const data = inputData.value as SpaceMetricsResults;
      const { spaces, totals } = data;

      if (displayMode === "chart") {
        // Bubble chart style visualization showing area vs occupancy
        const spaceEntries = Object.entries(spaces)
          .filter(([id, space]) => space.area > 0) // Only spaces with area
          .sort((a, b) => b[1].area - a[1].area)
          .slice(0, 12); // Top 12 spaces

        const maxArea = Math.max(...spaceEntries.map(([id, space]) => space.area));
        const maxOccupancy = Math.max(...spaceEntries.map(([id, space]) => space.occupancy));

        return (
          <div className="space-y-3">
            <div className="text-xs mb-1 flex justify-between">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                <span>Area vs Occupancy (Top 12)</span>
              </span>
              <span>m² / people</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs" style={{ maxHeight: `${contentHeight - 60}px`, overflowY: 'auto' }}>
              {spaceEntries.map(([spaceId, space], i) => {
                const areaPercent = (space.area / maxArea) * 100;
                const occupancyPercent = maxOccupancy > 0 ? (space.occupancy / maxOccupancy) * 100 : 0;
                const bubbleSize = Math.max(8, Math.min(24, areaPercent / 4));

                return (
                  <div key={spaceId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{
                          width: `${bubbleSize}px`,
                          height: `${bubbleSize}px`,
                          backgroundColor: COLORS[i % COLORS.length],
                          minWidth: `${bubbleSize}px`
                        }}
                      >
                        {space.occupancy}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={space.name}>
                          {space.name.length > 20 ? `${space.name.substring(0, 20)}...` : space.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {space.type}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{space.area.toFixed(1)} m²</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {space.occupancy > 0 ? `${(space.area / space.occupancy).toFixed(1)} m²/p` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="text-xs mb-2 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Space Metrics</span>
            </span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 dark:bg-blue-900 p-2 rounded">
              <div className="font-medium text-blue-800 dark:text-blue-200">Total Area</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-300">{totals.totalArea.toFixed(0)} m²</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 p-2 rounded">
              <div className="font-medium text-green-800 dark:text-green-200">Occupancy</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-300">{totals.totalOccupancy}</div>
            </div>
          </div>

          {/* Spaces table */}
          <div className="overflow-auto" style={{ maxHeight: `${contentHeight - 120}px` }}>
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="p-1 text-left">Space</th>
                  <th className="p-1 text-right">Area</th>
                  <th className="p-1 text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(spaces).slice(0, 20).map(([spaceId, space], i) => (
                  <tr key={spaceId} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 truncate max-w-[100px]" title={space.name}>
                      {space.name}
                    </td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">{space.area.toFixed(1)} m²</td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">{space.occupancy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // Render circulation analysis results
    const renderCirculationResults = (): JSX.Element | null => {
      if (inputData.type !== "circulation" || !inputData.value) {
        return null;
      }

      const data = inputData.value as CirculationResults;
      const { circulationArea, programArea, totalArea, circulationRatio, circulationSpaces, programSpaces } = data;

      if (displayMode === "chart") {
        // Show individual circulation and program spaces with their areas
        const allSpaces = [
          ...data.details.circulation.map(space => ({ ...space, category: 'Circulation', color: '#FF8042' })),
          ...data.details.program.map(space => ({ ...space, category: 'Program', color: '#0088FE' }))
        ].sort((a, b) => {
          // Sort by category first, then by name
          if (a.category !== b.category) {
            return a.category === 'Circulation' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return (
          <div className="space-y-3">
            <div className="text-xs mb-1 flex justify-between">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                <span>Circulation vs Program Spaces</span>
              </span>
              <span>{allSpaces.length} spaces</span>
            </div>

            {/* Summary ratio bar */}
            <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
              <div
                className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(circulationRatio * 100)}%` }}
              >
                {circulationRatio > 0.15 ? `${(circulationRatio * 100).toFixed(1)}%` : ''}
              </div>
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${((1 - circulationRatio) * 100)}%` }}
              >
                {(1 - circulationRatio) > 0.15 ? `${((1 - circulationRatio) * 100).toFixed(1)}%` : ''}
              </div>
            </div>

            {/* Space list */}
            <div className="space-y-1" style={{ maxHeight: `${contentHeight - 100}px`, overflowY: 'auto' }}>
              {allSpaces.slice(0, 15).map((space, i) => (
                <div key={`${space.category}-${space.id}`} className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: space.color }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={space.name}>
                      {space.name.length > 25 ? `${space.name.substring(0, 25)}...` : space.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {space.type || space.category}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {space.category}
                  </div>
                </div>
              ))}
              {allSpaces.length > 15 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  ... and {allSpaces.length - 15} more spaces
                </div>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="text-xs mb-2 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Circulation Analysis</span>
            </span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-orange-50 dark:bg-orange-900 p-2 rounded">
              <div className="font-medium text-orange-800 dark:text-orange-200">Circulation</div>
              <div className="text-lg font-bold text-orange-600 dark:text-orange-300">{circulationArea.toFixed(0)} m²</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">{(circulationRatio * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900 p-2 rounded">
              <div className="font-medium text-blue-800 dark:text-blue-200">Program</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-300">{programArea.toFixed(0)} m²</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{((programArea / totalArea) * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Space counts */}
          <div className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <span>Circulation Spaces: <strong>{circulationSpaces}</strong></span>
            <span>Program Spaces: <strong>{programSpaces}</strong></span>
          </div>
        </div>
      );
    };

    // Render occupancy analysis results
    const renderOccupancyResults = (): JSX.Element | null => {
      if (inputData.type !== "occupancy" || !inputData.value) {
        return null;
      }

      const data = inputData.value as OccupancyResults;
      const { spaces, summary } = data;

      if (displayMode === "chart") {
        // Horizontal bar chart showing occupancy density by individual spaces
        const spacesWithDensity = spaces
          .filter(space => space.area > 0 && space.occupancy > 0)
          .map(space => ({
            ...space,
            density: space.area / space.occupancy, // m² per person
            efficiency: space.occupancyFactor // Lower factor = higher efficiency
          }))
          .sort((a, b) => a.density - b.density) // Sort by density (most efficient first)
          .slice(0, 10);

        const maxDensity = Math.max(...spacesWithDensity.map(s => s.density));

        return (
          <div className="space-y-3">
            <div className="text-xs mb-1 flex justify-between">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                <span>Space Efficiency (Top 10)</span>
              </span>
              <span>m²/person</span>
            </div>

            {/* Efficiency legend */}
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>High Efficiency (≤5 m²/p)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>Medium (5-15 m²/p)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Low (&gt;15 m²/p)</span>
              </div>
            </div>

            <div className="space-y-2" style={{ maxHeight: `${contentHeight - 120}px`, overflowY: 'auto' }}>
              {spacesWithDensity.map((space, i) => {
                const densityPercent = (space.density / maxDensity) * 100;
                const getEfficiencyColor = (density: number) => {
                  if (density <= 5) return '#10B981'; // green
                  if (density <= 15) return '#F59E0B'; // yellow
                  return '#EF4444'; // red
                };

                return (
                  <div key={space.spaceId} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={space.spaceName}>
                          {space.spaceName.length > 20 ? `${space.spaceName.substring(0, 20)}...` : space.spaceName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {space.spaceType} • {space.occupancy} people
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: getEfficiencyColor(space.density) }}>
                          {space.density.toFixed(1)} m²/p
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {space.area.toFixed(0)} m²
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(5, densityPercent)}%`,
                          backgroundColor: getEfficiencyColor(space.density)
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="text-xs mb-2 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Occupancy Analysis</span>
            </span>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-50 dark:bg-purple-900 p-2 rounded">
              <div className="font-medium text-purple-800 dark:text-purple-200">Total Occupancy</div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-300">{summary.totalOccupancy}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 p-2 rounded">
              <div className="font-medium text-green-800 dark:text-green-200">Avg Density</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-300">{summary.averageOccupancyDensity.toFixed(1)} m²/p</div>
            </div>
          </div>

          {/* Spaces table */}
          <div className="overflow-auto" style={{ maxHeight: `${contentHeight - 120}px` }}>
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="p-1 text-left">Space</th>
                  <th className="p-1 text-right">Area</th>
                  <th className="p-1 text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {spaces.slice(0, 20).map((space, i) => (
                  <tr key={space.spaceId} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 truncate max-w-[100px]" title={space.spaceName}>
                      {space.spaceName}
                    </td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">{space.area.toFixed(1)} m²</td>
                    <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">{space.occupancy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    // Enhanced function to render quantity results with better grouping visualization
    const renderQuantityResults = (): JSX.Element | null => {
      if (inputData.type !== "quantityResults" || !inputData.value) {
        return null;
      }

      // Destructure correctly
      const { groups, unit, total, error, groupBy } = inputData.value as QuantityResults & {
        error?: string;
        groupBy?: string;
      };

      // Make sure we have valid groups
      if (!groups || typeof groups !== 'object') {
        return (
          <div className="text-xs text-gray-500 dark:text-gray-400 p-2">
            No valid quantity data found
          </div>
        );
      }

      const groupEntries = Object.entries(groups || {});

      // Helper to format quantity values nicely, considering the type
      const formatQuantity = (value: number, type: string | undefined): string => {
        // Handle count separately - always show as integer
        if (type === "count") {
          return value.toFixed(0);
        }

        // Existing formatting for other types
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(2)}k`;
        } else {
          return value.toFixed(2);
        }
      };

      // Helper function to format unit symbols with superscripts
      const formatUnitSymbol = (symbol: string | null | undefined): string => {
        if (!symbol) return "";
        return symbol.replace('2', '²').replace('3', '³');
      };

      // Helper to get color based on group value percentage of total
      const getGroupColor = (value: number): string => {
        const percentage = (value / total) * 100;
        // Use a blue gradient from light to dark based on percentage
        if (percentage > 50) return "bg-blue-600 dark:bg-blue-700";
        if (percentage > 30) return "bg-blue-500 dark:bg-blue-600";
        if (percentage > 20) return "bg-blue-400 dark:bg-blue-500";
        if (percentage > 10) return "bg-blue-300 dark:bg-blue-400";
        return "bg-blue-200 dark:bg-blue-300";
      };



      // Custom tooltip for pie chart
      const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) {
          return null;
        }

        const data = payload[0];
        const name = data.name;
        const value = data.value;
        const color = data.payload.fill;
        const percentage = ((value / total) * 100).toFixed(1);

        return (
          <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-xs dark:text-gray-200">
            <div className="font-medium mb-1 flex items-center gap-1.5">
              <div style={{ backgroundColor: color, width: '10px', height: '10px', borderRadius: '50%' }} />
              {name}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Value:</span>
              <span>{inputData?.value?.quantityType === 'count' ? value.toFixed(0) : value.toFixed(2)} {formatUnitSymbol(unit)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400">Percentage:</span>
              <span>{percentage}%</span>
            </div>
          </div>
        );
      };

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

      // Get the groupBy type for display
      const groupByType = groupBy || 'none';
      const groupByLabel = groupByType === 'type' ? 'By Class' :
        groupByType === 'level' ? 'By Level' :
          groupByType === 'material' ? 'By Material' : '';

      // Format data for pie chart
      const pieData = groupEntries.map(([name, value], index) => ({
        name,
        value,
        fill: COLORS[index % COLORS.length]
      }));

      // Determine which visualization to show based on display mode and data
      const hasMultipleGroups = groupEntries.length > 1;
      const showPieChart = displayMode === 'chart';
      // Always show the table when the pie chart is shown, or if displayMode is table
      const showTable = showPieChart || displayMode === 'table';
      // The bar chart is only shown in table mode when there are few groups
      const showBarChart = displayMode === 'table' && hasMultipleGroups && groupEntries.length <= 8 && groupEntries.length > 1;

      return (
        <div className="space-y-3">
          <div className="text-xs mb-1 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              <span>Quantity Results</span>
              {groupByLabel && (
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full ml-1">
                  {groupByLabel}
                </span>
              )}
            </span>
            <span className="text-xs font-medium">
              {formatUnitSymbol(unit)}
            </span>
          </div>

          {/* Pie chart visualization - only shown in chart mode */}
          {showPieChart && (
            <div style={{ width: '100%', height: Math.min(contentHeight - 50, 220) }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={contentHeight > 200 ? 80 : 60}
                    innerRadius={contentHeight > 200 ? 40 : 30}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                    label={({ name, percent }) => {
                      // Only show label if percentage is significant enough (>= 5%)
                      if (percent < 0.05) return null;
                      return `${(percent * 100).toFixed(1)}%`;
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconSize={10}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: '10px',
                      paddingLeft: '10px',
                      lineHeight: '14px'
                    }}
                    formatter={(value, entry) => (
                      <span style={{ color: 'inherit', marginLeft: '2px' }}>
                        {value.length > 12 ? `${value.substring(0, 12)}...` : value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar chart visualization of groups - ONLY shown in table mode */}
          {showBarChart && (
            <div className="space-y-1.5">
              {groupEntries.map(([key, value]: [string, number], i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="truncate max-w-[150px]" title={key}>{key}</span>
                    <span className="font-medium">{formatQuantity(value, inputData.type)} {formatUnitSymbol(unit)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getGroupColor(value)}`}
                      style={{ width: `${Math.max(3, (value / total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table view - Shown in table mode OR chart mode */}
          {showTable && (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                  <tr>
                    <th className="p-1 text-left">Group</th>
                    <th className="p-1 text-right">Value</th>
                    <th className="p-1 text-right">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {groupEntries.map(([key, value]: [string, number], i: number) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}`}>
                      <td className="p-1 border-t border-gray-200 dark:border-gray-600">{key}</td>
                      <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">
                        {inputData?.value?.quantityType === 'count' ? value.toFixed(0) : value.toFixed(2)} {formatUnitSymbol(unit)}
                      </td>
                      <td className="p-1 border-t border-gray-200 dark:border-gray-600 text-right">
                        {((value / total) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-500 font-medium">
                    <td className="p-1">Total</td>
                    <td className="p-1 text-right" colSpan={2}>
                      {inputData?.value?.quantityType === 'count' ? total.toFixed(0) : total.toFixed(2)} {formatUnitSymbol(unit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Total value as a large number */}
          <div className="flex justify-between items-end pt-1 border-t border-gray-200 dark:border-gray-600">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
            <span className="text-xl font-bold">{formatQuantity(total, inputData.type)} <span className="text-xs">{formatUnitSymbol(unit)}</span></span>
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

      // Special handling for different analysis result types
      if (inputData.type === "propertyResults") {
        return renderPropertyResults();
      }

      if (inputData.type === "roomAssignment" && (displayMode === "table" || displayMode === "chart")) {
        return renderRoomAssignmentResults();
      }

      if (inputData.type === "spaceMetrics" && (displayMode === "table" || displayMode === "chart")) {
        return renderSpaceMetricsResults();
      }

      if (inputData.type === "circulation" && (displayMode === "table" || displayMode === "chart")) {
        return renderCirculationResults();
      }

      if (inputData.type === "occupancy" && (displayMode === "table" || displayMode === "chart")) {
        return renderOccupancyResults();
      }

      // Special handling for quantity results - use for both table and chart modes
      if (inputData.type === "quantityResults" && (displayMode === "table" || displayMode === "chart")) {
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
                            {String(count)}
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

      return null;
    };

    // Display mode indicator
    const getDisplayModeIcon = () => {
      switch (displayMode) {
        case "raw":
          return <Code className="h-3 w-3" />;
        case "chart":
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
                  : displayMode === "chart"
                    ? "Chart"
                    : "Table"}
              </span>
              {selected && (
                <span className="text-[9px] text-gray-400 ml-1.5">Press 'D' to change view</span>
              )}
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

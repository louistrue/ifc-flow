"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import {
  Home,
  BarChart3,
  Settings2,
  Sparkles,
  Building2,
  Users,
  Square,
  Layers,
  Activity
} from "lucide-react";
import { AnalysisNodeData } from "./node-types";

// Space analysis metric configurations
const spaceMetrics = [
  {
    id: "room_assignment",
    label: "Room Assignment",
    icon: Home,
    description: "Map elements to spaces",
    color: "from-blue-500 to-indigo-500"
  },
  {
    id: "space_metrics",
    label: "Space Metrics",
    icon: BarChart3,
    description: "Area, volume, occupancy",
    color: "from-purple-500 to-pink-500"
  },
  {
    id: "circulation",
    label: "Circulation",
    icon: Activity,
    description: "Circulation vs program",
    color: "from-green-500 to-teal-500"
  },
  {
    id: "occupancy",
    label: "Occupancy",
    icon: Users,
    description: "Space occupancy analysis",
    color: "from-orange-500 to-red-500"
  }
];

export const AnalysisNode = memo(({ data, id, isConnectable }: NodeProps<AnalysisNodeData>) => {
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const { setNodes } = useReactFlow();

  // Get current metric or default to room_assignment
  const currentMetric = data.properties?.metric || "room_assignment";
  const selectedMetric = spaceMetrics.find(m => m.id === currentMetric) || spaceMetrics[0];

  // Check if we have results
  const hasResults = data.result !== undefined && data.result !== null;
  const hasError = data.error !== undefined && data.error !== null;
  const isLoading = data.isLoading || false;

  // Update progress messages from node data or use defaults when loading starts
  useEffect(() => {
    if (isLoading) {
      // Use progress messages from node data if available, otherwise use defaults
      const nodeProgressMessages = data.progressMessages || [];

      if (nodeProgressMessages.length > 0) {
        // Use real progress messages from the worker
        setProgressMessages(nodeProgressMessages);
      } else {
        // Use initial default messages when starting
        setProgressMessages([
          "[Space Analysis Worker] Starting analysis...",
          "Loading IFC model...",
          "Initializing spatial analysis...",
          "Pre-fetching containment relationships...",
          "Ready to process spaces..."
        ]);
      }
    } else {
      setProgressMessages([]);
    }
  }, [isLoading, data.progressMessages]);

  const handleMetricSelect = useCallback((metricId: string) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              properties: {
                ...node.data.properties,
                analysisType: "space", // Always space for now
                metric: metricId,
              },
            },
          };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const getStatusIcon = () => {
    if (isLoading) return <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />;
    if (hasError) return <div className="h-4 w-4 rounded-full bg-red-400 animate-pulse" />;
    if (hasResults) return <div className="h-4 w-4 rounded-full bg-green-400" />;
    return <Settings2 className="h-4 w-4 opacity-60" />;
  };

  const getStatusText = () => {
    if (isLoading) return "Analyzing...";
    if (hasError) return "Error";
    if (hasResults) return "Complete";
    return "Ready";
  };

  const MetricIcon = selectedMetric.icon;

  return (
    <>
      <div className="relative group">
        {/* Main node container with gradient border effect */}
        <div className={`
          absolute inset-0 rounded-xl opacity-75 blur-sm
          bg-gradient-to-br ${selectedMetric.color}
          ${isLoading ? 'animate-pulse' : ''}
          transition-all duration-500
        `} />

        <div className="
          relative bg-white dark:bg-gray-900 
          rounded-xl shadow-lg 
          border border-gray-200 dark:border-gray-700
          w-64 overflow-hidden
          hover:shadow-xl transition-all duration-200
          cursor-pointer
        ">
          {/* Header with gradient */}
          <div className={`
            bg-gradient-to-r ${selectedMetric.color}
            text-white px-4 py-3
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{data.label || "Space Analysis"}</div>
                  <div className="text-[10px] opacity-90">Spatial Intelligence</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                <Sparkles className="h-3 w-3 opacity-70" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {getStatusText()}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-500">
                Space Analysis
              </span>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4">
            {/* Selected metric display */}
            <div className="mb-3">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg">
                <div className={`
                  p-2 rounded-lg bg-gradient-to-br ${selectedMetric.color}
                  text-white shadow-md
                `}>
                  <MetricIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedMetric.label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {selectedMetric.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress console (when loading) */}
            {isLoading && (
              <div className="mb-3 p-3 bg-black dark:bg-gray-950 rounded-lg border border-gray-700">
                <div className="text-[10px] font-mono text-green-400 mb-1 flex items-center gap-1">
                  <span className="animate-pulse">●</span>
                  Space Analysis Console
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {progressMessages.map((message, index) => {
                    const isLatest = index === progressMessages.length - 1;
                    const isProcessing = message.includes("Processing space");

                    return (
                      <div
                        key={`${index}-${message}`}
                        className={`text-[9px] font-mono ${isProcessing
                          ? 'text-yellow-300'
                          : message.includes("Found") || message.includes("Pre-fetching")
                            ? 'text-blue-300'
                            : message.includes("Worker") || message.includes("Loading")
                              ? 'text-gray-300'
                              : 'text-green-300'
                          } ${isLatest && isProcessing ? 'animate-pulse' : ''}`}
                      >
                        {message}
                        {isLatest && isProcessing && <span className="animate-pulse ml-1">▊</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick metrics selector (visible on hover, hidden when loading) */}
            {!isLoading && (
              <div className="space-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="text-[10px] font-medium text-gray-400 mb-1">Quick Select:</div>
                <div className="grid grid-cols-2 gap-1">
                  {spaceMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <button
                        key={metric.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMetricSelect(metric.id);
                        }}
                        className={`
                        flex items-center gap-1.5 px-2 py-1.5 rounded-md
                        text-[10px] font-medium transition-all
                        ${currentMetric === metric.id
                            ? 'bg-gradient-to-r ' + metric.color + ' text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }
                      `}
                      >
                        <Icon className="h-3 w-3" />
                        <span className="truncate">{metric.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}



            {/* Result preview (if any) */}
            {hasResults && (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                <div className="text-[10px] text-green-600 dark:text-green-400">
                  Analysis complete
                </div>
              </div>
            )}

            {/* Error display (if any) */}
            {hasError && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                <div className="text-[10px] text-red-600 dark:text-red-400">
                  {data.error || "Analysis failed"}
                </div>
              </div>
            )}
          </div>

          {/* Handles - simplified to just input and output */}
          <Handle
            type="target"
            position={Position.Left}
            id="input"
            style={{
              background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
              width: 10,
              height: 10,
              border: "2px solid white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
            isConnectable={isConnectable}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            style={{
              background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
              width: 10,
              height: 10,
              border: "2px solid white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}
            isConnectable={isConnectable}
          />
        </div>
      </div>


    </>
  );
});

AnalysisNode.displayName = "AnalysisNode";
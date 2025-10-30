"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { type NodeProps, useReactFlow } from "reactflow";
import { Home, BarChart3, Settings2, Building2, Users, Activity } from "lucide-react";
import { AnalysisNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";
import { useNodeProgress } from "./base/use-node-progress";

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

export const AnalysisNode = memo((props: NodeProps<AnalysisNodeData>) => {
  const { data, id, isConnectable, selected } = props;
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const { setNodes } = useReactFlow();
  const { messages: progressMessagesHook, addMessage, clear: clearProgress } = useNodeProgress();

  // Get current metric or default to room_assignment
  const currentMetric = data.properties?.metric || "room_assignment";
  const selectedMetric = spaceMetrics.find(m => m.id === currentMetric) || spaceMetrics[0];

  // Check if we have results
  const hasResults = data.result !== undefined && data.result !== null;
  const hasError = data.error !== undefined && data.error !== null;
  const isLoading = data.isLoading || false;
  
  // Derive progress from data or use hook messages
  const currentProgress = data.progressMessages && data.progressMessages.length > 0
    ? { percentage: 0, message: data.progressMessages[data.progressMessages.length - 1] }
    : progressMessagesHook.length > 0
    ? { percentage: 0, message: progressMessagesHook[progressMessagesHook.length - 1] }
    : null;

  // Update progress messages from node data or use defaults when loading starts
  useEffect(() => {
    if (isLoading) {
      // Use progress messages from node data if available, otherwise use defaults
      const nodeProgressMessages = data.progressMessages || [];

      if (nodeProgressMessages.length > 0) {
        // Use progress messages from the worker
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

  const MetricIcon = selectedMetric.icon;
  
  return (
    <BaseNode
      {...props}
      isLoading={isLoading}
      error={hasError ? (data.error || "Analysis failed") : null}
      progress={currentProgress}
      showStatusIcon={true}
      theme={nodeThemes.analysis}
    >
      <div className="p-3 text-xs">
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md bg-gradient-to-br ${selectedMetric.color} text-white`}>
              <MetricIcon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{selectedMetric.label}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {selectedMetric.description}
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mb-2 p-2 bg-black dark:bg-gray-950 rounded-md border border-gray-700">
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
                    className={`text-[9px] font-mono ${
                      isProcessing
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

        {!isLoading && (
          <div className="space-y-1">
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
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                      currentMetric === metric.id
                        ? 'bg-gradient-to-r ' + metric.color + ' text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="truncate">{metric.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasResults && (
          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
            <div className="text-[10px] text-green-600 dark:text-green-400">Analysis complete</div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

AnalysisNode.displayName = "AnalysisNode";

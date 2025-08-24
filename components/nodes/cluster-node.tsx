"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Layers, Eye, EyeOff, Palette } from "lucide-react";
import { NodeStatusBadge } from "../node-status-badge";
import type { NodeStatus } from "@/components/node-status-badge";
import { BaseNodeData } from "./node-types";
import { toggleClusterVisibility, isolateClusters, showAllClusters } from "@/lib/ifc/cluster-utils";
import { withActiveViewer } from "@/lib/ifc/viewer-manager";

interface ClusterNodeData extends BaseNodeData {
  status?: NodeStatus;
  clusterResult?: {
    clusters: Array<{
      key: string;
      displayName: string;
      count: number;
      color: string;
      visible: boolean;
      elementIds: number[];
    }>;
    config: {
      groupBy: string;
      property?: string;
      pset?: string;
    };
    stats: {
      totalClusters: number;
      totalElements: number;
      visibleClusters: number;
    };
    totalElements: number;
    error?: string;
  };
  clusterSet?: any; // Non-serializable cluster set for operations
}

export const ClusterNode = memo(
  ({ data, isConnectable }: NodeProps<ClusterNodeData>) => {
    const status = data?.status || "working";
    const clusterResult = data?.clusterResult;
    const clusterSet = data?.clusterSet;
    const hasError = clusterResult?.error;

    const handleClusterToggle = (clusterKey: string, visible: boolean) => {
      if (clusterSet) {
        toggleClusterVisibility(clusterSet, clusterKey, visible);
        // TODO: trigger a re-render
        // This could be done through a state management system or callback
      }
    };

    const handleIsolateCluster = (clusterKey: string) => {
      if (clusterSet) {
        isolateClusters(clusterSet, [clusterKey]);
      }
    };

    const handleShowAll = () => {
      if (clusterSet) {
        showAllClusters(clusterSet);
      }
    };

    const handleResetSpatialClustering = () => {
      withActiveViewer(viewer => {
        if (viewer && typeof viewer.resetSpatialClustering === 'function') {
          viewer.resetSpatialClustering();
        }
      });
    };

    return (
      <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-64 shadow-md">
        <div className="bg-purple-500 text-white px-3 py-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm font-medium truncate" title={data.label}>
              {data.label}
            </div>
          </div>
          <NodeStatusBadge status={status} />
        </div>

        <div className="p-3 text-xs">
          {hasError && (
            <div className="text-red-500 mb-2">
              Error: {clusterResult?.error}
            </div>
          )}

          {clusterResult && !hasError && (
            <>
              <div className="flex justify-between mb-2">
                <span>Group By:</span>
                <span className="font-medium capitalize">
                  {clusterResult.config.groupBy}
                  {clusterResult.config.property && ` (${clusterResult.config.property})`}
                </span>
              </div>

              <div className="flex justify-between mb-2">
                <span>Total Clusters:</span>
                <span className="font-medium">{clusterResult.stats.totalClusters}</span>
              </div>

              <div className="flex justify-between mb-2">
                <span>Total Elements:</span>
                <span className="font-medium">{clusterResult.stats.totalElements}</span>
              </div>

              <div className="flex justify-between mb-3">
                <span>Visible:</span>
                <span className="font-medium">{clusterResult.stats.visibleClusters}</span>
              </div>

              {clusterResult.clusters.length > 0 && (
                <>
                  <div className="border-t pt-2 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Clusters:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={handleShowAll}
                          className="text-xs bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded"
                          title="Show All"
                        >
                          Show All
                        </button>
                        <button
                          onClick={handleResetSpatialClustering}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                          title="Reset Positions"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {clusterResult.clusters.slice(0, 8).map((cluster) => (
                        <div
                          key={cluster.key}
                          className="flex items-center justify-between gap-1 p-1 rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: cluster.color }}
                            />
                            <span className="truncate text-xs" title={cluster.displayName}>
                              {cluster.displayName}
                            </span>
                            <span className="text-gray-500 text-xs">({cluster.count})</span>
                          </div>

                          <div className="flex gap-1">
                            <button
                              onClick={() => handleClusterToggle(cluster.key, !cluster.visible)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title={cluster.visible ? "Hide" : "Show"}
                            >
                              {cluster.visible ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-gray-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleIsolateCluster(cluster.key)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Isolate"
                            >
                              <Palette className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {clusterResult.clusters.length > 8 && (
                        <div className="text-xs text-gray-500 text-center py-1">
                          ... and {clusterResult.clusters.length - 8} more
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {!clusterResult && !hasError && (
            <div className="text-gray-500">
              Connect geometry input to create clusters
            </div>
          )}
        </div>

        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
      </div>
    );
  }
);

ClusterNode.displayName = "ClusterNode";

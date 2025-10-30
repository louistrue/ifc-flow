"use client";

import { memo } from "react";
import { type NodeProps } from "reactflow";
import type { IfcModel } from "@/lib/ifc-utils";
import { GeometryNodeData as BaseGeometryNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";
import { hasActiveModel } from "@/lib/ifc/viewer-manager";

interface GeometryNodeProgress {
  percentage: number;
  message?: string;
}

// Extend the base type with additional properties
interface ExtendedGeometryNodeData extends BaseGeometryNodeData {
  status?: any;
  model?: IfcModel;
  elements?: any[];
  isLoading?: boolean;
  progress?: GeometryNodeProgress | null;
  error?: string | null;
  hasRealGeometry?: boolean;
  viewerElementCount?: number;
}

export const GeometryNode = memo(
  (props: NodeProps<ExtendedGeometryNodeData>) => {
    const { data } = props;
    const isLoading = data?.isLoading || false;
    const progress = data?.progress;
    const error = data?.error;
    const hasRealGeometry = data?.hasRealGeometry || false;
    const viewerElementCount = data?.viewerElementCount || 0;

    return (
      <BaseNode
        {...props}
        isLoading={isLoading}
        error={error || null}
        progress={progress || null}
        showStatusIcon={true}
        theme={nodeThemes.geometry}
      >
        {!isLoading && !error && (
          <div className="p-3 text-xs">
            <div className="flex justify-between mb-1">
              <span>Element Type:</span>
              <span className="font-medium">
                {data.properties?.elementType || "All"}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Include Openings:</span>
              <span className="font-medium">
                {data.properties?.includeOpenings === "false" ? "No" : "Yes"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Geometry Source:</span>
              <span className="font-medium">
                {hasRealGeometry ? "Three.js Meshes" : "IFC Data Only"}
              </span>
            </div>
            {data.elements && (
              <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                <span>Filtered Elements:</span>
                <span className="font-medium">{data.elements.length}</span>
              </div>
            )}
            {hasRealGeometry && viewerElementCount > 0 && (
              <div className="flex justify-between mt-1 text-xs text-green-600">
                <span>Viewer Elements:</span>
                <span className="font-medium">{viewerElementCount}</span>
              </div>
            )}
            {!hasRealGeometry && hasActiveModel() && (
              <div className="flex justify-between mt-1 text-xs text-amber-600">
                <span>Viewer available</span>
                <span>(enable real geometry)</span>
              </div>
            )}
          </div>
        )}
      </BaseNode>
    );
  }
);

GeometryNode.displayName = "GeometryNode";

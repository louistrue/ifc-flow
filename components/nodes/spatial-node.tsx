"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Layers, Building } from "lucide-react";

export const SpatialNode = memo(({ data, isConnectable }) => {
  // Helper to check if we have spatial structure elements
  const hasSpatialRefs = data.referenceElements?.some((el: any) =>
    [
      "IFCPROJECT",
      "IFCSITE",
      "IFCBUILDING",
      "IFCBUILDINGSTOREY",
      "IFCSPACE",
    ].includes(el.type.toUpperCase())
  );

  return (
    <div className="bg-white border-2 border-lime-500 rounded-md w-48 shadow-md">
      <div className="bg-lime-500 text-white px-3 py-1 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Query Type:</span>
            <span className="font-medium">
              {data.properties?.queryType || "Contained In"}
            </span>
          </div>
          {data.properties?.queryType === "within-distance" ? (
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="font-medium">
                {data.properties.distance || "1.0"}m
              </span>
            </div>
          ) : null}

          {/* Show spatial structure indicator if reference elements are spatial */}
          {hasSpatialRefs && (
            <div className="flex items-center gap-1 text-blue-600 mt-2">
              <Building className="h-3 w-3" />
              <span className="text-xs">Using Spatial Structure</span>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-xs text-blue-500">
            <span>Elements</span>
            <span>Reference</span>
          </div>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="reference"
        style={{ background: "#7c3aed", width: 8, height: 8 }}
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
});

SpatialNode.displayName = "SpatialNode";

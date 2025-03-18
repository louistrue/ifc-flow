"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Download } from "lucide-react";

export const ExportNode = memo(({ data, isConnectable }) => {
  return (
    <div className="bg-white border-2 border-sky-500 rounded-md w-48 shadow-md">
      <div className="bg-sky-500 text-white px-3 py-1 flex items-center gap-2">
        <Download className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Format:</span>
            <span className="font-medium">
              {data.properties?.format || "CSV"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>File Name:</span>
            <span className="font-medium truncate">
              {data.properties?.fileName || "export"}
            </span>
          </div>
          {(data.properties?.format === "csv" ||
            data.properties?.format === "excel" ||
            data.properties?.format === "json") &&
          data.properties?.properties ? (
            <div className="flex justify-between">
              <span>Properties:</span>
              <span className="font-medium truncate">
                {data.properties.properties}
              </span>
            </div>
          ) : null}
        </div>
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

ExportNode.displayName = "ExportNode";

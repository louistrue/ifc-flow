"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Download, UploadCloud } from "lucide-react";
import { ExportNodeData } from "./node-types";

export const ExportNode = memo(({ data, isConnectable }: NodeProps<ExportNodeData>) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-sky-500 dark:border-sky-400 rounded-md w-48 shadow-md">
      <div className="bg-sky-500 text-white px-3 py-1 flex items-center gap-2">
        <UploadCloud className="h-4 w-4" />
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

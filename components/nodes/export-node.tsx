"use client";

import { memo } from "react";
import { type NodeProps } from "reactflow";
import { UploadCloud } from "lucide-react";
import { ExportNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const ExportNode = memo((props: NodeProps<ExportNodeData>) => {
  const { data } = props;
  // ExportNodeData doesn't have isLoading/error, so we'll check data directly
  const isLoading = (data as any).isLoading || false;
  const error = (data as any).error;
  
  return (
    <BaseNode
      {...props}
      isLoading={isLoading}
      error={error || null}
      showStatusIcon={true}
      theme={nodeThemes.export}
    >
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span>Format:</span>
            <div className="flex items-center gap-1">
              <span className="font-medium">
                {data.properties?.format || "CSV"}
              </span>
              {data.properties?.format === "glb" && (
                <span className="text-[10px] bg-amber-500 text-white px-1 py-0.5 rounded">WIP</span>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span>File Name:</span>
            <span className="font-medium truncate">
              {data.properties?.fileName || "export"}
            </span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

ExportNode.displayName = "ExportNode";

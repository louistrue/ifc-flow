"use client"

import { memo } from "react"
import { type NodeProps, Position } from "reactflow"
import { SpatialNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const SpatialNode = memo((props: NodeProps<SpatialNodeData>) => {
  const { data } = props;
  
  return (
    <BaseNode
      {...props}
      isLoading={(data as any).isLoading || false}
      error={(data as any).error || null}
      showStatusIcon={true}
      theme={nodeThemes.spatial}
      extraHandles={[
        {
          type: 'target',
          position: Position.Top,
          id: 'reference',
          style: { background: "#7c3aed", width: 8, height: 8 }
        }
      ]}
    >
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Query Type:</span>
            <span className="font-medium">{data.properties?.queryType || "Contained In"}</span>
          </div>
          {data.properties?.queryType === "within-distance" ? (
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="font-medium">{data.properties.distance || "1.0"}m</span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between text-xs text-blue-500">
            <span>Elements</span>
            <span>Reference</span>
          </div>
        </div>
      </div>
    </BaseNode>
  )
})

SpatialNode.displayName = "SpatialNode"


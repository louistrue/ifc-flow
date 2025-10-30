"use client"

import { memo } from "react"
import { type NodeProps } from "reactflow"
import { RelationshipNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const RelationshipNode = memo((props: NodeProps<RelationshipNodeData>) => {
  const { data } = props;
  
  return (
    <BaseNode
      {...props}
      isLoading={(data as any).isLoading || false}
      error={(data as any).error || null}
      showStatusIcon={true}
      theme={nodeThemes.relationship}
    >
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Relationship:</span>
            <span className="font-medium truncate">{data.properties?.relationType || "Containment"}</span>
          </div>
          <div className="flex justify-between">
            <span>Direction:</span>
            <span className="font-medium">{data.properties?.direction || "Outgoing"}</span>
          </div>
        </div>
      </div>
    </BaseNode>
  )
})

RelationshipNode.displayName = "RelationshipNode"


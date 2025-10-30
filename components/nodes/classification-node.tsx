"use client"

import { memo } from "react"
import { type NodeProps } from "reactflow"
import { ClassificationNodeData } from "./node-types"
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const ClassificationNode = memo((props: NodeProps<ClassificationNodeData>) => {
  const { data } = props;
  
  return (
    <BaseNode
      {...props}
      isLoading={(data as any).isLoading || false}
      error={(data as any).error || null}
      showStatusIcon={true}
      theme={nodeThemes.classification}
    >
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>System:</span>
            <span className="font-medium">{data.properties?.system || "Uniclass"}</span>
          </div>
          <div className="flex justify-between">
            <span>Action:</span>
            <span className="font-medium">{data.properties?.action || "Get"}</span>
          </div>
          {data.properties?.action === "set" && data.properties?.code ? (
            <div className="flex justify-between">
              <span>Code:</span>
              <span className="font-medium">{data.properties.code}</span>
            </div>
          ) : null}
        </div>
      </div>
    </BaseNode>
  )
})

ClassificationNode.displayName = "ClassificationNode"


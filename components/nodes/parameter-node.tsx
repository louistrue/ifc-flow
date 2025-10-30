"use client"

import { memo } from "react"
import { type NodeProps } from "reactflow"
import { ParameterNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const ParameterNode = memo((props: NodeProps<ParameterNodeData>) => {
  const { data } = props;
  const paramType = data.properties?.paramType || "number"
  const value = data.properties?.value || (paramType === "number" ? "0" : "")

  return (
    <BaseNode
      {...props}
      isLoading={(data as any).isLoading || false}
      error={(data as any).error || null}
      showStatusIcon={true}
      theme={nodeThemes.transform}
    >
      <div className="p-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="font-medium">{paramType}</span>
          </div>
          <div className="flex justify-between">
            <span>Value:</span>
            <span className="font-medium truncate">{value}</span>
          </div>
          {paramType === "number" && data.properties?.range && (
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-medium">
                {data.properties.range.min} - {data.properties.range.max}
              </span>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  )
})

ParameterNode.displayName = "ParameterNode"


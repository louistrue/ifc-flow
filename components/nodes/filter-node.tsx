"use client"

import { memo } from "react"
import { type NodeProps } from "reactflow"
import { FilterNodeData } from "./node-types";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const FilterNode = memo((props: NodeProps<FilterNodeData>) => {
  const { data } = props;
  
  return (
    <BaseNode
      {...props}
      isLoading={(data as any).isLoading || false}
      error={(data as any).error || null}
      showStatusIcon={true}
      theme={nodeThemes.filter}
    >
      <div className="p-3 text-xs">
        {data.properties?.filterType === "property" && data.properties?.property ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-medium">Property</span>
            </div>
            <div className="flex justify-between">
              <span>Property:</span>
              <span className="font-medium">{data.properties.property}</span>
            </div>
            <div className="flex justify-between">
              <span>Operator:</span>
              <span className="font-medium">{data.properties?.operator || "equals"}</span>
            </div>
            <div className="flex justify-between">
              <span>Value:</span>
              <span className="font-medium">{data.properties?.value || ""}</span>
            </div>
          </div>
        ) : data.properties?.filterType === "ifcClass" && data.properties?.ifcClass ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-medium">IFC Class</span>
            </div>
            <div className="flex justify-between">
              <span>Class:</span>
              <span className="font-medium">{data.properties.ifcClass}</span>
            </div>
            <div className="flex justify-between">
              <span>Operator:</span>
              <span className="font-medium">{data.properties?.operator || "contains"}</span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No filter configured</div>
        )}
      </div>
    </BaseNode>
  )
})

FilterNode.displayName = "FilterNode"


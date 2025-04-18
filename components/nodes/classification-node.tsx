"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { FileText } from "lucide-react"
import { ClassificationNodeData } from "./node-types"

export const ClassificationNode = memo(({ data, isConnectable }: NodeProps<ClassificationNodeData>) => {
  return (
    <div className="bg-white border-2 border-indigo-500 rounded-md w-48 shadow-md">
      <div className="bg-indigo-500 text-white px-3 py-1 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
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
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
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
  )
})

ClassificationNode.displayName = "ClassificationNode"


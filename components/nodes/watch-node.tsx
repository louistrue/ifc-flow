"use client"

import { memo } from "react"
import { Handle, Position } from "reactflow"
import { Eye } from "lucide-react"

export const WatchNode = memo(({ data, isConnectable }) => {
  // Mock data for visualization
  const mockData = data.mockData || {
    type: "object",
    value: {
      "Wall 1": { Area: "24.5 m²", Volume: "5.3 m³" },
      "Wall 2": { Area: "18.2 m²", Volume: "4.1 m³" },
    },
  }

  const renderData = () => {
    const displayMode = data.properties?.displayMode || "table"

    if (displayMode === "raw") {
      return (
        <div className="bg-gray-50 p-1 rounded text-xs font-mono overflow-auto max-h-32">
          {JSON.stringify(mockData.value, null, 2)}
        </div>
      )
    } else if (displayMode === "table" && mockData.type === "object") {
      return (
        <div className="overflow-auto max-h-32">
          <table className="w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-1 text-left">Key</th>
                <th className="p-1 text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mockData.value).map(([key, value], i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="p-1 border-t border-gray-200">{key}</td>
                  <td className="p-1 border-t border-gray-200">
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else {
      return <div className="text-center text-xs text-muted-foreground">Connect an input to see data</div>
    }
  }

  return (
    <div className="bg-white border-2 border-teal-500 rounded-md w-64 shadow-md">
      <div className="bg-teal-500 text-white px-3 py-1 flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3">
        <div className="text-xs mb-1 flex justify-between">
          <span>Display: {data.properties?.displayMode || "Table"}</span>
          <span className="text-muted-foreground">{data.properties?.autoUpdate ? "Auto" : "Manual"}</span>
        </div>
        {renderData()}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
    </div>
  )
})

WatchNode.displayName = "WatchNode"


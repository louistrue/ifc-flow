"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useChat } from "ai/react";
import { Bot } from "lucide-react";
import type { AiNodeData } from "./node-types";

export const AiNode = memo(({ data, isConnectable }: NodeProps<AiNodeData>) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai",
    body: { modelId: data.model?.id }
  });

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 rounded-md w-64 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2 rounded-t-md">
        <Bot className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-2 h-40 overflow-y-auto text-xs space-y-1">
        {messages.map(m => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={`${
              m.role === "user"
                ? "bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100"
                : "bg-gray-100 dark:bg-gray-700"
            } inline-block px-2 py-1 rounded`}>
              {m.content}
            </span>
          </div>
        ))}
        {isLoading && <div className="text-gray-500">...</div>}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask..."
          className="w-full bg-transparent text-xs outline-none"
        />
      </form>
      <Handle
        type="target"
        position={Position.Left}
        id="model"
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
  );
});

AiNode.displayName = "AiNode";


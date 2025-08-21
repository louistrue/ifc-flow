"use client";

import { memo, useEffect } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import { useChat } from "ai/react";
import type { AiNodeData } from "./node-types";
import { Bot } from "lucide-react";

export const AiNode = memo(({ data, id, isConnectable }: NodeProps<AiNodeData>) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai",
    body: { modelId: data.model?.id },
    initialMessages: data.messages || [],
  });

  const { setNodes } = useReactFlow();

  useEffect(() => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                messages,
                isLoading,
              },
            }
          : n
      )
    );
  }, [messages, isLoading, id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow-md w-64">
      <div className="px-3 py-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-t-md flex items-center gap-2">
        <Bot className="h-4 w-4" />
        <span className="text-sm font-medium truncate">{data.label}</span>
      </div>
      <div className="p-3 text-xs space-y-2">
        <div className="h-32 overflow-y-auto border rounded-md p-1 bg-gray-50 dark:bg-gray-900">
          {messages.map((m, i) => (
            <div key={i} className="mb-1">
              <span className="font-bold mr-1">{m.role === "user" ? "You" : "AI"}:</span>
              {m.content}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-1">
          <input
            className="flex-1 border rounded px-1 py-0.5 bg-white dark:bg-gray-700"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-2 py-0.5 bg-sky-500 text-white rounded disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
      <Handle type="target" position={Position.Left} id="input" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" isConnectable={isConnectable} />
    </div>
  );
});

AiNode.displayName = "AiNode";

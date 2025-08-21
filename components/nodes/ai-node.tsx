"use client";

/* eslint-disable import/no-unresolved */
import { memo } from "react";
import { useChat } from "ai/react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { AiNodeData } from "./node-types";

export const AiNode = memo(({ data, isConnectable }: NodeProps<AiNodeData>) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai",
    body: { modelId: data.model?.id },
    initialMessages: data.messages || [],
  });

  return (
    <div className="bg-white dark:bg-gray-800 border rounded-md w-64 p-2 shadow-sm">
      <div className="h-40 overflow-y-auto text-xs space-y-1">
        {messages.map((m) => (
          <div key={m.id} className="whitespace-pre-wrap">
            <span className="font-semibold mr-1">{m.role}:</span>
            {m.content}
          </div>
        ))}
        {isLoading && <div className="text-gray-400">...</div>}
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex gap-1">
        <input
          className="flex-1 border rounded px-1 py-0.5 text-xs"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question"
        />
        <button
          type="submit"
          className="border rounded px-2 text-xs bg-gray-50 dark:bg-gray-700"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
      <Handle type="target" position={Position.Left} id="input" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" isConnectable={isConnectable} />
    </div>
  );
});

AiNode.displayName = "AiNode";

export default AiNode;

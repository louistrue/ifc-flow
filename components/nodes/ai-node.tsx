"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import type { AiNodeData } from "./node-types";
import { Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const AiNode = memo(({ data, id, isConnectable }: NodeProps<AiNodeData>) => {
  const [messages, setMessages] = useState<Message[]>((data.messages as Message[]) || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { setNodes, getNodes, getEdges } = useReactFlow();

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

  // Helper function to get model data from connected IFC nodes
  const getConnectedModelData = () => {
    const nodes = getNodes();
    const edges = getEdges();

    // Find edges that connect to this AI node's input
    const incomingEdges = edges.filter(edge => edge.target === id && edge.targetHandle === 'input');

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.type === 'ifcNode' && sourceNode.data.model) {
        return sourceNode.data.model;
      }
    }

    // Fallback to AI node's own model data (set by workflow executor)
    return data.model || null;
  };

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
              <span className="text-gray-700 dark:text-gray-300">{m.content}</span>
            </div>
          ))}
          {isLoading && (
            <div className="mb-1">
              <span className="font-bold mr-1">AI:</span>
              <span className="text-gray-500 animate-pulse">Thinking...</span>
            </div>
          )}
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (input.trim() && !isLoading) {
            const userMessage: Message = { role: "user", content: input };
            const newMessages = [...messages, userMessage];

            setMessages(newMessages);
            setInput("");
            setIsLoading(true);

            try {
              console.log("🤖 Sending AI chat request:", {
                messageCount: newMessages.length,
                lastMessage: userMessage.content
              });

              // Get the current model data from connected IFC nodes
              const currentModel = getConnectedModelData();

              console.log("📊 Model data for AI request:", {
                hasModel: !!currentModel,
                modelName: currentModel?.name,
                totalElements: currentModel?.totalElements,
                elementsCount: currentModel?.elements?.length
              });

              const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: newMessages,
                  modelData: currentModel ? {
                    id: currentModel.id,
                    name: currentModel.name,
                    schema: currentModel.schema,
                    totalElements: currentModel.totalElements,
                    elementCounts: currentModel.elementCounts,
                    // Send ALL elements for accurate Python execution
                    elements: currentModel.elements // Send full dataset, not just sample
                  } : null
                }),
              });

              if (response.ok) {
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let aiResponse = "";

                console.log("📡 Starting AI response stream...");

                if (reader) {
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) {
                        console.log("Stream reading done, final response length:", aiResponse.length);
                        break;
                      }

                      const chunk = decoder.decode(value, { stream: true });
                      if (chunk) {
                        console.log("Stream chunk received:", {
                          length: chunk.length,
                          content: chunk.substring(0, 100),
                          raw: chunk,
                          valueLength: value?.length
                        });
                        aiResponse += chunk;
                        // Update messages with streaming response
                        setMessages([...newMessages, { role: "assistant", content: aiResponse }]);
                      } else {
                        console.log("Empty chunk received");
                      }
                    }

                    console.log("✅ AI Response Complete:", {
                      responseLength: aiResponse.length,
                      response: aiResponse.substring(0, 100) + (aiResponse.length > 100 ? "..." : "")
                    });
                  } finally {
                    reader.releaseLock();
                  }
                }
              } else {
                console.error("❌ API request failed:", response.status);
                const errorText = await response.text();
                console.error("Error details:", errorText);
                setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
              }
            } catch (error) {
              console.error("Error sending message:", error);
              setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
            } finally {
              setIsLoading(false);
            }
          }
        }} className="flex gap-1">
          <input
            className="flex-1 border rounded px-1 py-0.5 bg-white dark:bg-gray-700"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-0.5 bg-sky-500 text-white rounded disabled:opacity-50"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
      <Handle type="target" position={Position.Left} id="input" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" isConnectable={isConnectable} />
    </div>
  );
});

AiNode.displayName = "AiNode";

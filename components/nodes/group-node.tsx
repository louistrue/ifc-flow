"use client";

import { memo } from "react";
import { NodeProps, useReactFlow } from "reactflow";
import type { GroupNodeData } from "./node-types";

export const GroupNode = memo(({ id, data }: NodeProps<GroupNodeData>) => {
  const { setNodes } = useReactFlow();

  const onLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label: value } } : node
      )
    );
  };

  const onColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, backgroundColor: value } }
          : node
      )
    );
  };

  return (
    <div
      className="w-full h-full rounded border-2 border-blue-300 relative"
      style={{ backgroundColor: data.backgroundColor || "rgba(0,0,0,0.05)" }}
    >
      <div className="absolute top-1 left-1 flex items-center gap-1">
        <input
          value={data.label}
          onChange={onLabelChange}
          className="bg-transparent text-xs font-medium outline-none"
        />
        <input
          type="color"
          value={data.backgroundColor || "#f3f4f6"}
          onChange={onColorChange}
          className="w-4 h-4 p-0 border-none"
        />
      </div>
    </div>
  );
});

GroupNode.displayName = "GroupNode";

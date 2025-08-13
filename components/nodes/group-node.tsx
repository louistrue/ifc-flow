"use client";

import { useCallback } from "react";
import { NodeProps, useReactFlow } from "reactflow";
import type { GroupNodeData } from "./node-types";

export function GroupNode({ id, data }: NodeProps<GroupNodeData>) {
  const { setNodes } = useReactFlow();

  const onLabelChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const value = evt.target.value;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, label: value } } : node,
        ),
      );
    },
    [id, setNodes],
  );

  const onColorChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const value = evt.target.value;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, color: value } } : node,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <div
      className="w-full h-full rounded-md border border-muted-foreground/50"
      style={{ backgroundColor: data.color || "#f3f4f6" }}
    >
      <div className="flex items-center justify-between p-1 text-xs">
        <input
          className="bg-transparent outline-none w-full mr-1"
          value={data.label}
          onChange={onLabelChange}
        />
        <input type="color" value={data.color || "#f3f4f6"} onChange={onColorChange} />
      </div>
    </div>
  );
}

export default GroupNode;


"use client";

import { useState } from "react";
import { NodeProps, useReactFlow } from "reactflow";
import { cn } from "@/lib/utils";
import type { GroupNodeData } from "./node-types";

export function GroupNode({ id, data, selected }: NodeProps<GroupNodeData>) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const handleBlur = () => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node
      )
    );
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "relative w-full h-full rounded-md border-2",
        selected ? "border-blue-500" : "border-gray-400",
      )}
      style={{ backgroundColor: data.backgroundColor || "rgba(0,0,0,0.03)" }}
    >
      <div className="absolute top-1 left-1 text-xs">
        {editing ? (
          <input
            className="bg-transparent outline-none border-none"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleBlur()}
            autoFocus
          />
        ) : (
          <span onDoubleClick={() => setEditing(true)}>{data.label}</span>
        )}
      </div>
    </div>
  );
}

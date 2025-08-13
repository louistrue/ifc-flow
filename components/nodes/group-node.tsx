"use client";

import { memo, useState } from "react";
import { useReactFlow, type NodeProps } from "reactflow";

interface GroupNodeData {
  label?: string;
  backgroundColor?: string;
}

export const GroupNode = memo(({ id, data }: NodeProps<GroupNodeData>) => {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const label = data?.label ?? "Group";
  const bg = data?.backgroundColor || "rgba(0,0,0,0.05)";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: value } } : n
      )
    );
  };

  return (
    <div
      className="w-full h-full border border-muted-foreground rounded bg-opacity-50 relative"
      style={{ backgroundColor: bg }}
    >
      <div className="absolute top-1 left-1 text-xs font-medium text-foreground">
        {editing ? (
          <input
            className="bg-transparent border border-input rounded px-1 py-0.5 text-xs outline-none"
            autoFocus
            value={label}
            onChange={handleChange}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <span onDoubleClick={() => setEditing(true)}>{label}</span>
        )}
      </div>
    </div>
  );
});

GroupNode.displayName = "GroupNode";

export type { GroupNodeData };


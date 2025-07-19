"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import { Code } from "lucide-react";
import { PythonNodeData as BasePythonNodeData } from "./node-types";
import { runPython } from "@/lib/ifc-utils";
import type { IfcModel } from "@/lib/ifc/ifc-loader";

interface ExtendedPythonNodeData extends BasePythonNodeData {
  inputData?: IfcModel;
  result?: any;
  isRunning?: boolean;
  error?: string | null;
}

export const PythonNode = memo(({ id, data, isConnectable }: NodeProps<ExtendedPythonNodeData>) => {
  const { setNodes } = useReactFlow();
  const [script, setScript] = useState(data.properties?.script || "");

  useEffect(() => {
    setScript(data.properties?.script || "");
  }, [data.properties?.script]);

  const runScript = useCallback(async () => {
    if (!data.inputData) return;
    setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, isRunning: true, error: null } } : node));
    try {
      const result = await runPython(data.inputData, script);
      setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, result, isRunning: false, properties: { ...node.data.properties, script } } } : node));
    } catch (e: any) {
      setNodes(nodes => nodes.map(node => node.id === id ? { ...node, data: { ...node.data, isRunning: false, error: e.message } } : node));
    }
  }, [data.inputData, id, script, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-64 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
        <Code className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-2 text-xs space-y-1">
        <textarea
          className="w-full h-24 text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded p-1"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="# Python code here\nresult = len(ifc_file.by_type('IfcWall'))"
        />
        <button
          className="text-blue-500 hover:text-blue-700 text-xs"
          onClick={(e) => { e.stopPropagation(); runScript(); }}
        >
          Run
        </button>
        {data.isRunning && <div className="text-gray-500">Running...</div>}
        {data.error && <div className="text-red-500">{data.error}</div>}
        {data.result !== undefined && !data.isRunning && !data.error && (
          <div className="break-words">{JSON.stringify(data.result).slice(0, 100)}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="input" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" style={{ background: "#555", width: 8, height: 8 }} isConnectable={isConnectable} />
    </div>
  );
});

PythonNode.displayName = "PythonNode";

"use client";

import { memo, useState, useCallback } from "react";
import { type NodeProps, useReactFlow } from "reactflow";
import { Terminal, Play, Code2, Sparkles } from "lucide-react";
import { PythonNodeData } from "./node-types";
import { PythonEditorDialog } from "@/components/dialogs/python-editor-dialog";
import { BaseNode } from "./base/base-node";
import { nodeThemes } from "./base/node-themes";

export const PythonNode = memo((props: NodeProps<PythonNodeData>) => {
  const { data, id } = props;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const code = data.properties?.code || "";
  const hasCode = code.trim().length > 0;
  const isLoading = data.isLoading || false;
  const error = data.error;
  const result = data.result;
  const progress = data.progress;

  // Get a nice preview of the code with basic syntax highlighting
  const getCodePreview = () => {
    if (!hasCode) return null;

    // Take first 3-4 meaningful lines, skip empty lines and comments
    const lines = code.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .slice(0, 3);

    if (lines.length === 0) {
      // If only comments/empty lines, show first actual line
      const firstLine = code.split('\n')[0] || "";
      return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
    }

    return lines.join('\n');
  };

  const getResultPreview = () => {
    if (isLoading) return { type: 'loading', content: "Executing Python code..." };
    if (error) return {
      type: 'error',
      content: error.length > 100 ? error.slice(0, 100) + "..." : error
    };
    if (result !== undefined && result !== null) {
      let content: string;
      let type = 'success';

      if (typeof result === 'object') {
        try {
          // Pretty format JSON with proper indentation
          content = JSON.stringify(result, null, 2);
          type = 'json';
        } catch {
          content = String(result);
        }
      } else if (typeof result === 'string') {
        content = result;
        type = 'string';
      } else {
        content = String(result);
      }

      return { type, content };
    }
    return null;
  };

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setIsEditorOpen(true);
  }, []);

  const handleSaveCode = useCallback((code: string) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              properties: {
                ...node.data.properties,
                code,
              },
              // Clear previous results when code changes
              result: undefined,
              error: null,
            },
          };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const codePreview = getCodePreview();
  const resultPreview = getResultPreview();

  return (
    <>
      <BaseNode
        {...props}
        isLoading={isLoading}
        error={error || null}
        progress={progress}
        showStatusIcon={true}
        theme={nodeThemes.python}
      >
        <div className="p-3" onDoubleClick={handleDoubleClick}>
          {/* Code Preview */}
          {hasCode ? (
            <div className="mb-3">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-2 border border-gray-200 dark:border-gray-700">
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                  {codePreview}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mb-3 text-center">
              <div className="text-gray-400 dark:text-gray-500 text-xs py-4">
                <Code2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No code yet</p>
                <p className="text-[10px] mt-1">Double-click to add Python code</p>
              </div>
            </div>
          )}

          {/* Result/Status Preview */}
          {resultPreview && (
            <div className="mt-2">
              <div className="text-[9px] font-medium text-gray-500 dark:text-gray-400 mb-1 px-1">
                OUTPUT
              </div>
              <div className={`rounded-md border ${resultPreview.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : resultPreview.type === 'loading'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                } max-h-24 overflow-hidden relative`}>
                <div className="p-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {resultPreview.type === 'loading' && <Sparkles className="h-3 w-3 animate-pulse text-blue-400" />}
                      {resultPreview.type === 'error' && <Terminal className="h-3 w-3 text-red-400" />}
                      {resultPreview.type === 'success' && <Terminal className="h-3 w-3 text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <pre className={`text-[9px] leading-tight font-mono break-words whitespace-pre-wrap ${resultPreview.type === 'error'
                        ? 'text-red-700 dark:text-red-300'
                        : resultPreview.type === 'loading'
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-green-700 dark:text-green-300'
                        }`}>
                        {resultPreview.content}
                      </pre>
                    </div>
                  </div>
                </div>
                {/* Fade overlay for overflow */}
                <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white dark:from-gray-800 to-transparent opacity-60 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Edit Hint */}
          <div className="mt-3 text-center">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <Play className="h-3 w-3" />
              Double-click to edit code
            </div>
          </div>

          {/* Code Lines Info */}
          {hasCode && (
            <div className="mt-2 text-center">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                <Code2 className="h-3 w-3" />
                {code.split('\n').length} lines
              </div>
            </div>
          )}
        </div>
      </BaseNode>

      <PythonEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        initialCode={code || "# Your Python code here\n# Access ifc_file, input_data, and properties\n\n# Example:\nresult = input_data"}
        onSave={handleSaveCode}
        nodeName={data.label}
      />
    </>
  );
});

PythonNode.displayName = "PythonNode";

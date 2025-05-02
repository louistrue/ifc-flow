"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
import { Sliders, ChevronDown, Check, X, Plus, Minus } from "lucide-react";

interface ParameterNodeData {
  label: string;
  properties?: {
    paramType?: string;
    value?: string;
    listItems?: string;
    range?: {
      min: number;
      max: number;
    };
  };
}

export const ParameterNode = memo(
  ({ data, id, isConnectable }: NodeProps<ParameterNodeData>) => {
    const { setNodes } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const paramType = data.properties?.paramType || "list";
    const value = data.properties?.value || "";
    const listItems = data.properties?.listItems || "";

    // Update editValue when value changes externally
    useEffect(() => {
      if (paramType === "list") {
        setEditValue(listItems);
      } else {
        setEditValue(value);
      }
    }, [value, listItems, paramType]);

    // Focus input when editing starts
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleValueChange = useCallback(
      (newValue: string) => {
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              if (paramType === "list") {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    properties: {
                      ...node.data.properties,
                      listItems: newValue,
                      // For lists, set the first non-empty item as the selected value
                      value:
                        newValue
                          .split(",")
                          .map((item) => item.trim())
                          .filter((item) => item.length > 0)[0] || "",
                    },
                  },
                };
              } else {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    properties: {
                      ...node.data.properties,
                      value: newValue,
                    },
                  },
                };
              }
            }
            return node;
          })
        );
      },
      [id, setNodes, paramType]
    );

    const handleTypeChange = useCallback(
      (newType: string) => {
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  properties: {
                    ...node.data.properties,
                    paramType: newType,
                    value: "",
                    listItems: "",
                  },
                },
              };
            }
            return node;
          })
        );
        setShowTypeMenu(false);
        setEditValue("");
      },
      [id, setNodes]
    );

    const startEditing = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (paramType === "list") {
        setEditValue(listItems);
      } else {
        setEditValue(value);
      }
      setIsEditing(true);
    };

    const finishEditing = () => {
      handleValueChange(editValue);
      setIsEditing(false);
    };

    const cancelEditing = () => {
      if (paramType === "list") {
        setEditValue(listItems);
      } else {
        setEditValue(value);
      }
      setIsEditing(false);
    };

    const getTypeIcon = (type: string) => {
      switch (type) {
        case "number":
          return "🔢";
        case "text":
          return "📄";
        case "list":
          return "📋";
        default:
          return "📦";
      }
    };

    const renderValueEditor = () => {
      if (!isEditing) {
        return (
          <button
            className="font-medium hover:text-yellow-600 transition-colors"
            onClick={startEditing}
          >
            {paramType === "list"
              ? listItems || "Enter items..."
              : value || "Enter value..."}
          </button>
        );
      }

      switch (paramType) {
        case "list":
          return (
            <div className="flex flex-col gap-1">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-32 px-2 py-1 border rounded text-xs bg-white"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") finishEditing();
                  if (e.key === "Escape") cancelEditing();
                }}
                placeholder="Item1, Item2, Item3"
              />
              {editValue && (
                <div className="text-xs text-gray-500">
                  Items:{" "}
                  {editValue
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
                    .join(", ")}
                </div>
              )}
            </div>
          );

        case "text":
          return (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-32 px-2 py-1 border rounded text-xs bg-white"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") finishEditing();
                if (e.key === "Escape") cancelEditing();
              }}
              placeholder="Enter text..."
            />
          );

        case "number":
          return (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentValue = parseFloat(editValue) || 0;
                    setEditValue((currentValue - 1).toString());
                  }}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  ref={inputRef}
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-16 px-1 py-0.5 border rounded text-xs bg-white text-center"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") finishEditing();
                    if (e.key === "Escape") cancelEditing();
                  }}
                />
                <button
                  className="p-1 hover:bg-gray-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentValue = parseFloat(editValue) || 0;
                    setEditValue((currentValue + 1).toString());
                  }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="bg-white border-2 border-yellow-500 rounded-md w-48 shadow-md">
        <div className="bg-yellow-500 text-white px-3 py-1 flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          <div className="text-sm font-medium truncate">{data.label}</div>
        </div>
        <div className="p-3 text-xs">
          <div className="space-y-2">
            {/* Type selector */}
            <div className="relative">
              <div
                className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTypeMenu(!showTypeMenu);
                }}
              >
                <div className="flex items-center gap-1">
                  <span>{getTypeIcon(paramType)}</span>
                  <span className="font-medium capitalize">{paramType}</span>
                </div>
                <ChevronDown className="h-3 w-3" />
              </div>
              {showTypeMenu && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-sm z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {["list", "text", "number"].map((type) => (
                    <div
                      key={type}
                      className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTypeChange(type);
                      }}
                    >
                      <span>{getTypeIcon(type)}</span>
                      <span className="capitalize">{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Value editor */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span>{paramType === "list" ? "Items:" : "Value:"}</span>
                <div className="flex items-center gap-2">
                  {renderValueEditor()}
                  {isEditing && (
                    <>
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-green-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          finishEditing();
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditing();
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Preview for list type */}
              {paramType === "list" && listItems && !isEditing && (
                <div className="text-xs text-gray-500">
                  Items:{" "}
                  {listItems
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0)
                    .join(", ")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />
      </div>
    );
  }
);

ParameterNode.displayName = "ParameterNode";

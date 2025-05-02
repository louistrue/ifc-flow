"use client";

import { memo, useState, useEffect } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
import { FileText, Check, X, Edit, Tag, ChevronDown } from "lucide-react";

interface ClassificationNodeData {
  label: string;
  properties?: {
    system?: string;
    action?: string;
    code?: string;
    name?: string;
    useInputValues?: boolean;
  };
  modelClassifications?: Array<{
    name: string;
    id?: string;
    references?: Array<{
      id: string;
      name: string;
      description?: string;
      itemReference?: string;
    }>;
  }>;
  inputValues?: {
    codes?: string[];
    names?: string[];
  };
}

export const ClassificationNode = memo(
  ({ data, id, isConnectable }: NodeProps<ClassificationNodeData>) => {
    const { setNodes } = useReactFlow();
    const [isEditingCode, setIsEditingCode] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [showInputToggle, setShowInputToggle] = useState(false);

    const useInputValues = data.properties?.useInputValues || false;
    const inputValues = data.inputValues || {};
    const action = (data.properties?.action || "get").toLowerCase();

    // Convert comma-separated input values to arrays if they're strings
    const processInputList = (value?: string) => {
      if (!value) return [];
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    };

    const codesArray = Array.isArray(inputValues.codes)
      ? inputValues.codes
      : typeof inputValues.codes === "string"
      ? processInputList(inputValues.codes)
      : [];

    const namesArray = Array.isArray(inputValues.names)
      ? inputValues.names
      : typeof inputValues.names === "string"
      ? processInputList(inputValues.names)
      : [];

    const [codeValue, setCodeValue] = useState(
      useInputValues ? codesArray[0] || "" : data.properties?.code || ""
    );
    const [nameValue, setNameValue] = useState(
      useInputValues
        ? namesArray[0] || ""
        : data.properties?.name || "Classification"
    );

    // Update values when input values change
    useEffect(() => {
      if (useInputValues) {
        setCodeValue(codesArray[0] || "");
        setNameValue(namesArray[0] || "");
      }
    }, [useInputValues, codesArray, namesArray]);

    // Ensure lowercase action for consistent processing
    const system = data.properties?.system || "custom";

    const handleActionChange = (newAction: string) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                properties: {
                  ...node.data.properties,
                  action: newAction.toLowerCase(),
                },
              },
            };
          }
          return node;
        })
      );
    };

    const handleSystemChange = (newSystem: string) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                properties: {
                  ...node.data.properties,
                  system: newSystem,
                },
              },
            };
          }
          return node;
        })
      );
    };

    const toggleInputValues = () => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                properties: {
                  ...node.data.properties,
                  useInputValues: !useInputValues,
                },
              },
            };
          }
          return node;
        })
      );
      setShowInputToggle(false);
    };

    const updateProperty = (property: string, value: string) => {
      if (useInputValues) return; // Don't update if using input values

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                properties: {
                  ...node.data.properties,
                  [property]: value,
                },
              },
            };
          }
          return node;
        })
      );
    };

    const updateCode = (newCode: string) => {
      const cleanCode = newCode.replace(/,/g, "");
      updateProperty("code", cleanCode);
      setCodeValue(cleanCode);
      setIsEditingCode(false);
    };

    const updateName = (newName: string) => {
      const cleanName = newName.replace(/,/g, "");
      updateProperty("name", cleanName);
      setNameValue(cleanName);
      setIsEditingName(false);
    };

    const renderEditableField = (
      label: string,
      value: string,
      isEditing: boolean,
      onEdit: () => void,
      onSave: (value: string) => void,
      onCancel: () => void,
      width: string = "w-20"
    ) => (
      <div className="flex justify-between items-center">
        <span>{label}:</span>
        {!isEditing ? (
          <div className="flex items-center">
            <span
              className={`font-medium mr-1 ${
                useInputValues ? "text-indigo-600" : ""
              }`}
            >
              {value || `Enter ${label.toLowerCase()}`}
            </span>
            {!useInputValues && (
              <button
                className="p-1 hover:bg-gray-100 rounded text-gray-600"
                onClick={onEdit}
              >
                <Edit className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                switch (label) {
                  case "Code":
                    setCodeValue(e.target.value);
                    break;
                  case "Name":
                    setNameValue(e.target.value);
                    break;
                }
              }}
              className={`${width} px-1 py-0.5 border rounded text-xs bg-white`}
              autoFocus
            />
            <button
              className="p-0.5 hover:bg-green-50 rounded text-green-600"
              onClick={() => onSave(value)}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:bg-red-50 rounded text-red-600"
              onClick={onCancel}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );

    return (
      <div className="bg-white border-2 border-indigo-500 rounded-md w-64 shadow-md">
        <div className="bg-indigo-500 text-white px-3 py-1 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <div className="text-sm font-medium truncate">{data.label}</div>
        </div>
        <div className="p-3 text-xs">
          <div className="space-y-2">
            {/* Input mode toggle */}
            <div className="relative">
              <div
                className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setShowInputToggle(!showInputToggle)}
              >
                <div className="flex items-center gap-1">
                  <span className="text-indigo-600">
                    {useInputValues ? "Using Input Lists" : "Direct Input"}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3" />
              </div>
              {showInputToggle && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-sm z-10">
                  <div
                    className="px-2 py-1 hover:bg-gray-50 cursor-pointer"
                    onClick={toggleInputValues}
                  >
                    {useInputValues
                      ? "Switch to Direct Input"
                      : "Use Input Lists"}
                  </div>
                </div>
              )}
            </div>

            {/* Action selector */}
            <div className="flex justify-between items-center">
              <span>Action:</span>
              <div className="flex gap-2">
                <button
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    action === "get"
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  onClick={() => handleActionChange("get")}
                >
                  Get
                </button>
                <button
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    action === "set"
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  onClick={() => handleActionChange("set")}
                >
                  Set
                </button>
              </div>
            </div>

            {/* System selector (only show in set mode) */}
            {action === "set" && (
              <div className="flex justify-between items-center">
                <span>System:</span>
                <select
                  className="px-1 py-0.5 border rounded text-xs bg-white"
                  value={system}
                  onChange={(e) => handleSystemChange(e.target.value)}
                >
                  <option value="custom">Custom</option>
                  <option value="uniclass">Uniclass 2015</option>
                  <option value="uniformat">Uniformat II</option>
                  <option value="masterformat">MasterFormat</option>
                  <option value="omniclass">OmniClass</option>
                  <option value="cobie">COBie</option>
                </select>
              </div>
            )}

            {/* Classification details for set mode */}
            {action === "set" && (
              <div className="space-y-2 mt-2">
                {useInputValues ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Codes List:</span>
                      <div className="flex items-center">
                        <span className={`font-medium mr-1 text-indigo-600`}>
                          {codesArray.length} items
                        </span>
                      </div>
                    </div>
                    {codesArray.length > 0 && (
                      <div className="text-xs text-gray-500 pl-4">
                        Preview: {codesArray.slice(0, 3).join(", ")}
                        {codesArray.length > 3 ? "..." : ""}
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span>Names List:</span>
                      <div className="flex items-center">
                        <span className={`font-medium mr-1 text-indigo-600`}>
                          {namesArray.length} items
                        </span>
                      </div>
                    </div>
                    {namesArray.length > 0 && (
                      <div className="text-xs text-gray-500 pl-4">
                        Preview: {namesArray.slice(0, 3).join(", ")}
                        {namesArray.length > 3 ? "..." : ""}
                      </div>
                    )}
                    {codesArray.length > 0 && namesArray.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Will create{" "}
                        {Math.min(codesArray.length, namesArray.length)}{" "}
                        classifications
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {renderEditableField(
                      "Code",
                      codeValue,
                      isEditingCode,
                      () => setIsEditingCode(true),
                      updateCode,
                      () => {
                        setCodeValue(data.properties?.code || "");
                        setIsEditingCode(false);
                      },
                      "w-16"
                    )}
                    {renderEditableField(
                      "Name",
                      nameValue,
                      isEditingName,
                      () => setIsEditingName(true),
                      updateName,
                      () => {
                        setNameValue(data.properties?.name || "Classification");
                        setIsEditingName(false);
                      }
                    )}
                  </>
                )}
              </div>
            )}

            {/* Information for get mode */}
            {action === "get" && (
              <div className="space-y-2 mt-2">
                {data.modelClassifications &&
                data.modelClassifications.length > 0 ? (
                  <div className="border-t mt-1 pt-2">
                    <div className="font-medium mb-1">
                      Model Classifications:
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {data.modelClassifications.map(
                        (classification, index) => (
                          <div key={index} className="mb-2">
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span className="font-medium">
                                {classification.name}
                              </span>
                            </div>
                            {classification.references &&
                              classification.references.length > 0 && (
                                <div className="ml-4 mt-1">
                                  {classification.references.map(
                                    (ref, refIndex) => (
                                      <div
                                        key={refIndex}
                                        className="text-xs text-gray-600"
                                      >
                                        {ref.id}: {ref.name}
                                        {ref.description &&
                                          ` - ${ref.description}`}
                                        {ref.itemReference &&
                                          ` (${ref.itemReference})`}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center italic py-1 border-t mt-1 pt-2">
                    No classifications found in the model
                    <br />
                    or waiting for model data
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Standard input handle for IFC data - always present */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{ background: "#555", width: 8, height: 8 }}
          isConnectable={isConnectable}
        />

        {/* Separate input handles for SET mode with input values */}
        {action === "set" && useInputValues && (
          <>
            <Handle
              type="target"
              position={Position.Left}
              id="input-codes"
              style={{ background: "#555", width: 8, height: 8, top: "40%" }}
              isConnectable={isConnectable}
            />
            <Handle
              type="target"
              position={Position.Left}
              id="input-names"
              style={{ background: "#555", width: 8, height: 8, top: "60%" }}
              isConnectable={isConnectable}
            />
          </>
        )}

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

ClassificationNode.displayName = "ClassificationNode";

"use client"

import { memo, useState, useEffect, useCallback } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow"
import { Filter } from "lucide-react"
import { FilterNodeData } from "./node-types";
import { FILTER_TYPES, FILTER_OPERATORS, COMMON_IFC_CLASSES } from "@/lib/ifc/filter-utils";

export const FilterNode = memo(({ data, id, isConnectable }: NodeProps<FilterNodeData>) => {
  const { setNodes } = useReactFlow();

  // Local state for filter configuration
  const [filterType, setFilterType] = useState(data.properties?.filterType || "ifcClass");
  const [operator, setOperator] = useState(data.properties?.operator || "equals");
  const [filterValue, setFilterValue] = useState(data.properties?.value || "");
  const [propertySet, setPropertySet] = useState(data.properties?.propertySet || ""); // For property filter

  // Update node data when local state changes
  const updateNodeProperties = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              properties: {
                ...node.data.properties,
                filterType,
                operator,
                value: filterValue,
                propertySet: filterType === 'property' ? propertySet : undefined, // Only store propertySet if relevant
              },
            },
          };
        }
        return node;
      })
    );
  }, [id, filterType, operator, filterValue, propertySet, setNodes]);

  // Effect to sync local state with node data (e.g., on load or external change)
  useEffect(() => {
    setFilterType(data.properties?.filterType || "ifcClass");
    setOperator(data.properties?.operator || "equals");
    setFilterValue(data.properties?.value || "");
    setPropertySet(data.properties?.propertySet || "");
  }, [data.properties]);

  // Effect to update node data when local state changes
  useEffect(() => {
    updateNodeProperties();
  }, [filterType, operator, filterValue, propertySet, updateNodeProperties]);

  // Handle filter type change
  const handleFilterTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setFilterType(newType);
    // Reset operator to default for the new type
    const defaultOperator = FILTER_OPERATORS[newType]?.[0]?.id || "equals";
    setOperator(defaultOperator);
    // Reset value and property set
    setFilterValue("");
    setPropertySet("");
  };

  // Handle operator change
  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOperator(e.target.value);
  };

  // Handle value change
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilterValue(e.target.value);
  };

  // Handle property set change (for property filter type)
  const handlePropertySetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPropertySet(e.target.value);
  };

  // Determine available operators based on selected filter type
  const availableOperators = FILTER_OPERATORS[filterType] || [];

  // Determine input type based on filter type
  const renderValueInput = () => {
    if (filterType === "ifcClass") {
      return (
        <select
          className="nodrag w-full p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200"
          value={filterValue}
          onChange={handleValueChange}
        >
          <option value="">Select IFC Class...</option>
          {COMMON_IFC_CLASSES.map(cls => (
            <option key={cls} value={cls}>{cls.replace('Ifc', '')}</option>
          ))}
          <option value="all">All Classes</option>
        </select>
      );
    } else if (filterType === 'propertySet' && (operator === 'exists' || operator === 'notExists')) {
      // No value needed for exists/notExists operator on propertySet
      return <span className="text-xs text-gray-400 italic">N/A</span>;
    } else {
      return (
        <input
          type="text"
          className="nodrag w-full p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200"
          value={filterValue}
          onChange={handleValueChange}
          placeholder={filterType === 'property' ? 'PropertyName' : 'Enter value...'}
        />
      );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-64 shadow-md">
      <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label || "Filter Elements"}</div>
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Filter By</label>
          <select
            className="nodrag w-full p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200"
            value={filterType}
            onChange={handleFilterTypeChange}
          >
            {FILTER_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>

        {filterType === 'property' && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Property Set (Optional)</label>
            <input
              type="text"
              className="nodrag w-full p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200"
              value={propertySet}
              onChange={handlePropertySetChange}
              placeholder="e.g., Pset_WallCommon"
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Operator</label>
          <select
            className="nodrag w-full p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200"
            value={operator}
            onChange={handleOperatorChange}
            disabled={availableOperators.length === 0}
          >
            {availableOperators.length > 0 ? (
              availableOperators.map(op => (
                <option key={op.id} value={op.id}>{op.label}</option>
              ))
            ) : (
              <option disabled>No operators</option>
            )}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            {filterType === 'propertySet' ? 'Set Name' : 'Value'}
          </label>
          {renderValueInput()}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
    </div>
  )
})

FilterNode.displayName = "FilterNode"


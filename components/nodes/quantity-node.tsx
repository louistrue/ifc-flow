"use client"

import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Calculator, ChevronDown } from "lucide-react"
import { QuantityNodeData } from "./node-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type QuantityType = NonNullable<QuantityNodeData['properties']>['quantityType'];
type GroupByType = NonNullable<QuantityNodeData['properties']>['groupBy'];

export const QuantityNode = memo(({ data, id, isConnectable, selected }: NodeProps<QuantityNodeData>) => {
  // Local state for the properties while the popover is open
  const [localQuantityType, setLocalQuantityType] = useState<QuantityType>(data.properties?.quantityType || "area");
  const [localGroupBy, setLocalGroupBy] = useState<GroupByType>(data.properties?.groupBy || "none");
  const [isOpen, setIsOpen] = useState(false);

  // Get the current values from node data with defaults
  const quantityType = data.properties?.quantityType || "area";
  const groupBy = data.properties?.groupBy || "none";

  // Format the labels for display
  const quantityTypeLabel = {
    "area": "Area",
    "volume": "Volume",
    "length": "Length",
    "count": "Count"
  }[quantityType as 'area' | 'volume' | 'length' | 'count'] || "Area";

  const groupByLabel = {
    "none": "None",
    "type": "By Class",
    "level": "By Level",
    "material": "By Material"
  }[groupBy as 'none' | 'type' | 'level' | 'material'] || "None";

  return (
    <div className={`bg-white dark:bg-gray-800 border-2 border-amber-500 dark:border-amber-400 rounded-md w-48 shadow-md ${selected ? 'ring-2 ring-amber-300' : ''
      }`}>
      <div className="bg-amber-500 text-white px-3 py-1 flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label || "Quantity Take-Off"}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-2">
          {/* Quantity Type Selector */}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex justify-between items-center mb-1">
              <span>Quantity Type:</span>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-medium gap-1">
                  {quantityTypeLabel}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
            </div>

            <PopoverContent className="w-44 p-2" align="end">
              <RadioGroup
                defaultValue={quantityType}
                onValueChange={(value) => {
                  setLocalQuantityType(value as QuantityType);
                  // Update node data directly
                  data.properties = {
                    ...data.properties,
                    quantityType: value as QuantityType
                  };
                }}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="area" id="area" />
                  <Label htmlFor="area" className="text-xs cursor-pointer">Area</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="volume" id="volume" />
                  <Label htmlFor="volume" className="text-xs cursor-pointer">Volume</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="length" id="length" />
                  <Label htmlFor="length" className="text-xs cursor-pointer">Length</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="count" id="count" />
                  <Label htmlFor="count" className="text-xs cursor-pointer">Count</Label>
                </div>
              </RadioGroup>
            </PopoverContent>
          </Popover>

          {/* Group By Selector */}
          <Popover>
            <div className="flex justify-between items-center mb-1">
              <span>Group By:</span>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-medium gap-1">
                  {groupByLabel}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
            </div>

            <PopoverContent className="w-44 p-2" align="end">
              <RadioGroup
                defaultValue={groupBy}
                onValueChange={(value) => {
                  setLocalGroupBy(value as GroupByType);
                  // Update node data directly
                  data.properties = {
                    ...data.properties,
                    groupBy: value as GroupByType
                  };
                }}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="text-xs cursor-pointer">None</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="type" id="type" />
                  <Label htmlFor="type" className="text-xs cursor-pointer">By Class</Label>
                </div>
                <div className="flex items-center space-x-2 mb-1">
                  <RadioGroupItem value="level" id="level" />
                  <Label htmlFor="level" className="text-xs cursor-pointer">By Level</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="material" id="material" />
                  <Label htmlFor="material" className="text-xs cursor-pointer">By Material</Label>
                </div>
              </RadioGroup>
            </PopoverContent>
          </Popover>

          <div className="flex justify-between">
            <span>Unit:</span>
            <span className="font-medium text-gray-500 italic">Auto (from IFC)</span>
          </div>
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

QuantityNode.displayName = "QuantityNode"


"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLastLoadedModel } from "@/lib/ifc-utils"
import { listModelProperties } from "@/lib/ifc/property-utils"

interface FilterEditorProps {
  properties: {
    property?: string;
    operator?: string;
    value?: string;
    [key: string]: any;
  };
  setProperties: (properties: any) => void;
}

export function FilterEditor({ properties, setProperties }: FilterEditorProps) {
  const [availableProps, setAvailableProps] = useState<string[]>([])

  useEffect(() => {
    const model = getLastLoadedModel()
    if (model) {
      setAvailableProps(listModelProperties(model))
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="property">Property</Label>
        <Input
          id="property"
          list="filter-properties"
          value={properties.property || ""}
          onChange={(e) => setProperties({ ...properties, property: e.target.value })}
          placeholder="e.g. Pset_WallCommon.FireRating"
        />
        {availableProps.length > 0 && (
          <datalist id="filter-properties">
            {availableProps.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="operator">Operator</Label>
        <Select
          value={properties.operator || "equals"}
          onValueChange={(value) => setProperties({ ...properties, operator: value })}
        >
          <SelectTrigger id="operator">
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="startsWith">Starts With</SelectItem>
            <SelectItem value="endsWith">Ends With</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="value">Value</Label>
        <Input
          id="value"
          value={properties.value || ""}
          onChange={(e) => setProperties({ ...properties, value: e.target.value })}
          placeholder="Value to match"
        />
      </div>
    </div>
  )
}


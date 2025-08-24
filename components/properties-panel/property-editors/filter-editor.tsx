"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import { getModelPropertyNames } from "@/lib/ifc-utils"

interface FilterEditorProps {
  properties: {
    filterType?: string;
    pset?: string;
    property?: string;
    value?: string;
    storey?: string;
    material?: string;
    [key: string]: any;
  };
  setProperties: (properties: any) => void;
}

export function FilterEditor({ properties, setProperties }: FilterEditorProps) {
  const [modelProps, setModelProps] = useState<string[]>([])

  useEffect(() => {
    setModelProps(getModelPropertyNames())
  }, [])

  const filterType = properties.filterType || "property"

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="filterType">Filter Type</Label>
        <Select
          value={filterType}
          onValueChange={(value) => setProperties({ ...properties, filterType: value })}
        >
          <SelectTrigger id="filterType">
            <SelectValue placeholder="Select filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="property">Property</SelectItem>
            <SelectItem value="storey">Building Storey</SelectItem>
            <SelectItem value="material">Material</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterType === "property" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="pset">Pset Name</Label>
            <Input
              id="pset"
              value={properties.pset || ""}
              onChange={(e) => setProperties({ ...properties, pset: e.target.value })}
              placeholder="e.g. Pset_WallCommon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property">Property Name</Label>
            <Input
              id="property"
              list="model-properties"
              value={properties.property || ""}
              onChange={(e) => setProperties({ ...properties, property: e.target.value })}
              placeholder="e.g. FireRating"
            />
            {modelProps.length > 0 && (
              <datalist id="model-properties">
                {modelProps.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={properties.value || ""}
              onChange={(e) => setProperties({ ...properties, value: e.target.value })}
              placeholder="Regex or comma-separated values"
            />
          </div>
        </>
      )}

      {filterType === "storey" && (
        <div className="space-y-2">
          <Label htmlFor="storey">Storey</Label>
          <Input
            id="storey"
            value={properties.storey || ""}
            onChange={(e) => setProperties({ ...properties, storey: e.target.value })}
            placeholder="Any or regex / enumeration"
          />
        </div>
      )}

      {filterType === "material" && (
        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={properties.material || ""}
            onChange={(e) => setProperties({ ...properties, material: e.target.value })}
            placeholder="Any or regex / enumeration"
          />
        </div>
      )}
    </div>
  )
}


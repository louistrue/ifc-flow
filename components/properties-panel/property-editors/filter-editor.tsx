"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FilterEditorProps {
  properties: {
    filterType?: string
    psetName?: string
    propertyName?: string
    value?: string
    storey?: string
    material?: string
    [key: string]: any
  }
  setProperties: (properties: any) => void
}

export function FilterEditor({ properties, setProperties }: FilterEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="filterType">Filter Type</Label>
        <Select
          value={properties.filterType || "property"}
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
      {properties.filterType === "property" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="psetName">Pset Name</Label>
            <Input
              id="psetName"
              value={properties.psetName || ""}
              onChange={(e) => setProperties({ ...properties, psetName: e.target.value })}
              placeholder="e.g. Pset_WallCommon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyName">Property Name</Label>
            <Input
              id="propertyName"
              value={properties.propertyName || ""}
              onChange={(e) => setProperties({ ...properties, propertyName: e.target.value })}
              placeholder="e.g. FireRating"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={properties.value || ""}
              onChange={(e) => setProperties({ ...properties, value: e.target.value })}
              placeholder="Regex or comma list"
            />
          </div>
        </>
      )}
      {properties.filterType === "storey" && (
        <div className="space-y-2">
          <Label htmlFor="storey">Storey</Label>
          <Input
            id="storey"
            value={properties.storey || ""}
            onChange={(e) => setProperties({ ...properties, storey: e.target.value })}
            placeholder="e.g. Level 1"
          />
        </div>
      )}
      {properties.filterType === "material" && (
        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={properties.material || ""}
            onChange={(e) => setProperties({ ...properties, material: e.target.value })}
            placeholder="e.g. Concrete"
          />
        </div>
      )}
    </div>
  )
}


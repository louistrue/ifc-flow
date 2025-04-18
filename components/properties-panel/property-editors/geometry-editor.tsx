"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface geometryEditorProps {
  properties: Record<string, any>;
  setProperties: (properties: Record<string, any>) => void;
}


export function GeometryEditor({ properties, setProperties }: geometryEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="elementType">Element Type</Label>
        <Select
          value={properties.elementType || "all"}
          onValueChange={(value) => setProperties({ ...properties, elementType: value })}
        >
          <SelectTrigger id="elementType">
            <SelectValue placeholder="Select element type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Elements</SelectItem>
            <SelectItem value="walls">Walls</SelectItem>
            <SelectItem value="slabs">Slabs</SelectItem>
            <SelectItem value="columns">Columns</SelectItem>
            <SelectItem value="beams">Beams</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="includeOpenings">Include Openings</Label>
        <Select
          value={properties.includeOpenings || "true"}
          onValueChange={(value) => setProperties({ ...properties, includeOpenings: value })}
        >
          <SelectTrigger id="includeOpenings">
            <SelectValue placeholder="Include openings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}


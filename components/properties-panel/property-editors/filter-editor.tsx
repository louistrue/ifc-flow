"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLastLoadedModel } from "@/lib/ifc-utils"

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
  const [availableProps, setAvailableProps] = useState<string[]>([]);

  useEffect(() => {
    const model = getLastLoadedModel();
    if (model) {
      const propSet = new Set<string>();
      model.elements.forEach((el) => {
        Object.keys(el.properties || {}).forEach((p) => propSet.add(p));
        if (el.psets) {
          for (const psetName in el.psets) {
            const pset = el.psets[psetName];
            Object.keys(pset || {}).forEach((prop) =>
              propSet.add(`${psetName}.${prop}`)
            );
          }
        }
      });
      setAvailableProps(Array.from(propSet).sort());
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="property">Property</Label>
        {availableProps.length > 0 ? (
          <Select
            value={properties.property || ""}
            onValueChange={(value) =>
              setProperties({ ...properties, property: value })
            }
          >
            <SelectTrigger id="property">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {availableProps.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="property"
            value={properties.property || ""}
            onChange={(e) =>
              setProperties({ ...properties, property: e.target.value })
            }
            placeholder="e.g. Pset_WallCommon.FireRating"
          />
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


import type { IfcModel } from "@/lib/ifc/ifc-loader";

// Count elements of given IFC type
export function countElements(model: IfcModel, type: string): number {
  return model.elements.filter((el) => el.type === type).length;
}

// Sum wall areas; expects each element may have properties.Area in m²
export function sumWallArea(model: IfcModel): number {
  return model.elements
    .filter((el) => el.type === "IfcWall")
    .reduce((sum, el) => {
      const area = typeof (el as any).properties?.Area === "number" ? (el as any).properties.Area : 0;
      return sum + area;
    }, 0);
}

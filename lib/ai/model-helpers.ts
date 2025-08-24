import type { IfcModel } from "@/lib/ifc-utils";

// Count elements of a given IFC type in the model
export function countElements(model: IfcModel | null | undefined, type: string): number {
  if (!model || !Array.isArray(model.elements)) return 0;
  return model.elements.filter((el) => el.type === type).length;
}

// Sum wall areas as a basic example
export function sumWallArea(model: IfcModel | null | undefined): number {
  if (!model || !Array.isArray(model.elements)) return 0;
  return model.elements
    .filter((el) => el.type === "IfcWall" && typeof (el as any).area === "number")
    .reduce((sum, el) => sum + ((el as any).area as number), 0);
}

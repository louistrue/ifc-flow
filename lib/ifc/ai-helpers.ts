import type { IfcModel } from "./ifc-loader";

const modelCache = new Map<string, IfcModel>();

export function cacheModel(id: string, model: IfcModel) {
  modelCache.set(id, model);
}

export function getCachedModel(id: string): IfcModel | undefined {
  return modelCache.get(id);
}

export function countElements(model: IfcModel, type: string): number {
  return model.elements.filter(el => el.type === type).length;
}

export function sumWallArea(model: IfcModel): number {
  return model.elements
    .filter(el => el.type === "IfcWall")
    .reduce((sum, el) => {
      const area =
        el.qtos?.BaseQuantities?.NetSideArea ||
        el.psets?.BaseQuantities?.NetSideArea ||
        el.properties?.Area ||
        0;
      return sum + Number(area);
    }, 0);
}

import type { IfcModel } from "./types";

// Global reference to the last loaded model
let _lastLoadedModel: IfcModel | null = null;

// Cache for storing the original File objects of loaded IFC files
const ifcFileCache: Map<string, File> = new Map();

export function cacheIfcFile(file: File) {
  if (file && file.name) {
    if (!ifcFileCache.has(file.name)) {
      ifcFileCache.set(file.name, file);
      console.log(`Cached File object: ${file.name}`);
    }
  } else {
    console.warn("Attempted to cache an invalid File object.");
  }
}

export function getIfcFile(fileName: string): File | null {
  return ifcFileCache.get(fileName) || null;
}

export function getLastLoadedModel(): IfcModel | null {
  console.log("🔍 Getting last loaded model:", {
    hasModel: !!_lastLoadedModel,
    modelId: _lastLoadedModel?.id,
    modelName: _lastLoadedModel?.name,
    elementCount: _lastLoadedModel?.elements?.length,
  });
  return _lastLoadedModel;
}

export function setLastLoadedModel(model: IfcModel | null): void {
  _lastLoadedModel = model;
  console.log("📝 Set last loaded model:", {
    hasModel: !!model,
    modelId: model?.id,
    modelName: model?.name,
    elementCount: model?.elements?.length,
  });
}

export function getModelPropertyNames(model?: IfcModel): string[] {
  const current = model || getLastLoadedModel();
  if (!current) return [];

  const props = new Set<string>();

  current.elements.forEach((el) => {
    if (el.properties) {
      Object.keys(el.properties).forEach((p) => props.add(p));
    }
    if (el.psets) {
      for (const pset in el.psets) {
        const psetProps = el.psets[pset];
        for (const prop in psetProps) {
          props.add(`${pset}.${prop}`);
        }
      }
    }
  });

  return Array.from(props).sort();
}

// Expose internal cache for modules needing raw access (avoid exporting the map)
export const __stateInternals = {
  get cache() {
    return ifcFileCache;
  },
  get lastModel() {
    return _lastLoadedModel;
  },
};


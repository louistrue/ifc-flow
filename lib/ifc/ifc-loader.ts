// Core IFC loading functionality
export interface IfcElement {
  id: string;
  expressId: number;
  type: string;
  properties: Record<string, any>;

  // Property sets (from ifcopenshell.util.element.get_psets)
  psets?: Record<string, Record<string, any>>;

  // Quantity sets (from ifcopenshell.util.element.get_psets with qtos_only=True)
  qtos?: Record<string, Record<string, any>>;

  // Optional geometry data
  geometry?: any;

  // Property info for property operations
  propertyInfo?: {
    name: string;
    exists: boolean;
    value: any;
    psetName: string;
  };

  // Classifications array
  classifications?: Array<{
    System: string;
    Code: string;
    Description: string;
  }>;

  // Transformed geometry data
  transformedGeometry?: {
    translation: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface IfcModel {
  id: string;
  name: string;
  file?: any;
  schema?: string;
  project?: {
    GlobalId: string;
    Name: string;
    Description: string;
  };
  elementCounts?: Record<string, number>;
  totalElements?: number;
  elements: IfcElement[];
}

// Mock function to load an IFC file
export async function loadIfcFile(file: File): Promise<IfcModel> {
  // In a real implementation, this would use web-ifc to parse the IFC file
  console.log("Loading IFC file:", file.name);

  // Return a mock model
  return {
    id: "mock-model",
    name: file.name,
    elements: [
      {
        id: "wall-1",
        expressId: 1001,
        type: "IfcWall",
        properties: {
          Name: "Wall 1",
          Material: "Concrete",
          Level: "Level 1",
        },
      },
      {
        id: "slab-1",
        expressId: 1002,
        type: "IfcSlab",
        properties: {
          Name: "Slab 1",
          Material: "Concrete",
          Level: "Level 1",
        },
      },
      {
        id: "column-1",
        expressId: 1003,
        type: "IfcColumn",
        properties: {
          Name: "Column 1",
          Material: "Steel",
          Level: "Level 1",
        },
      },
    ],
  };
}

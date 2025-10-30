import type { IfcModel, IfcElement } from '@/lib/ifc-utils'

/**
 * Mock IFC model data for testing
 */
export const mockIfcModel: IfcModel = {
  id: 'test-model-1',
  name: 'test-model.ifc',
  schema: 'IFC4',
  project: {
    GlobalId: 'test-project-guid',
    Name: 'Test Project',
    Description: 'Test project for unit tests',
  },
  elementCounts: {
    IfcWall: 10,
    IfcSlab: 5,
    IfcColumn: 8,
    IfcBeam: 12,
  },
  totalElements: 35,
  elements: [
    {
      id: 'wall-1',
      expressId: 1001,
      type: 'IfcWall',
      properties: {
        GlobalId: 'wall-guid-1',
        Name: 'Wall 1',
        Description: 'Test wall',
      },
      psets: {
        Pset_WallCommon: {
          IsExternal: true,
          FireRating: 'A',
        },
      },
    },
    {
      id: 'wall-2',
      expressId: 1002,
      type: 'IfcWall',
      properties: {
        GlobalId: 'wall-guid-2',
        Name: 'Wall 2',
        Description: 'Internal wall',
      },
      psets: {
        Pset_WallCommon: {
          IsExternal: false,
          FireRating: 'B',
        },
      },
    },
    {
      id: 'slab-1',
      expressId: 2001,
      type: 'IfcSlab',
      properties: {
        GlobalId: 'slab-guid-1',
        Name: 'Slab 1',
      },
      qtos: {
        Qto_SlabBaseQuantities: {
          Area: 100.5,
          Volume: 502.5,
        },
      },
    },
  ],
  sqliteDb: undefined,
  sqliteSuccess: false,
}

export const mockEmptyModel: IfcModel = {
  id: 'empty-model',
  name: 'empty.ifc',
  schema: 'IFC4',
  elementCounts: {},
  totalElements: 0,
  elements: [],
  sqliteDb: undefined,
  sqliteSuccess: false,
}

export const mockModelWithGeometry: IfcModel = {
  ...mockIfcModel,
  id: 'model-with-geometry',
  elements: mockIfcModel.elements.map((el) => ({
    ...el,
    geometry: {
      type: 'simplified',
      vertices: new Float32Array([
        0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, // front face
        0, 0, 3, 10, 0, 3, 10, 10, 3, 0, 10, 3, // back face
      ]),
      indices: new Uint32Array([
        0, 1, 2, 0, 2, 3, // front
        4, 6, 5, 4, 7, 6, // back
        0, 4, 5, 0, 5, 1, // bottom
        2, 6, 7, 2, 7, 3, // top
        0, 3, 7, 0, 7, 4, // left
        1, 5, 6, 1, 6, 2, // right
      ]),
      normals: new Float32Array([
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      ]),
      dimensions: {
        width: 10,
        height: 10,
        depth: 3,
      },
    },
  })),
}


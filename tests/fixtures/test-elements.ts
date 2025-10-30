import type { IfcElement } from '@/lib/ifc-utils'

/**
 * Sample IFC elements with various properties for testing
 */
export const mockElements: IfcElement[] = [
  {
    id: 'wall-1',
    expressId: 1001,
    type: 'IfcWall',
    properties: {
      GlobalId: 'wall-guid-1',
      Name: 'Wall 1',
      Description: 'External wall',
    },
    psets: {
      Pset_WallCommon: {
        IsExternal: true,
        FireRating: 'A',
        LoadBearing: true,
      },
    },
    qtos: {
      Qto_WallBaseQuantities: {
        Length: 10.0,
        Area: 30.0,
        Volume: 3.0,
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
        LoadBearing: false,
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
  {
    id: 'column-1',
    expressId: 3001,
    type: 'IfcColumn',
    properties: {
      GlobalId: 'column-guid-1',
      Name: 'Column 1',
    },
    qtos: {
      Qto_ColumnBaseQuantities: {
        Length: 3.0,
        Volume: 0.5,
      },
    },
  },
  {
    id: 'door-1',
    expressId: 4001,
    type: 'IfcDoor',
    properties: {
      GlobalId: 'door-guid-1',
      Name: 'Door 1',
    },
    psets: {
      Pset_DoorCommon: {
        FireRating: '30',
        IsExternal: false,
      },
    },
  },
  {
    id: 'opening-1',
    expressId: 5001,
    type: 'IfcOpeningElement',
    properties: {
      GlobalId: 'opening-guid-1',
      Name: 'Opening 1',
    },
  },
]

export const mockElementWithPropertyInfo: IfcElement = {
  ...mockElements[0],
  propertyInfo: {
    name: 'IsExternal',
    exists: true,
    value: true,
    psetName: 'Pset_WallCommon',
  },
}

export const mockElementWithClassification: IfcElement = {
  ...mockElements[0],
  classifications: [
    {
      System: 'Uniclass 2015',
      Code: 'Pr_20_70_36_85',
      Description: 'External wall',
    },
  ],
}


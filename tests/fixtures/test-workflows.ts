import type { Node, Edge } from 'reactflow'

/**
 * Sample workflow configurations for testing
 */
export const mockSimpleWorkflow: { nodes: Node[]; edges: Edge[] } = {
  nodes: [
    {
      id: 'ifc-1',
      type: 'ifcNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'IFC File',
        file: null,
      },
    },
    {
      id: 'filter-1',
      type: 'filterNode',
      position: { x: 200, y: 0 },
      data: {
        label: 'Filter',
        properties: {
          property: 'Name',
          operator: 'contains',
          value: 'Wall',
        },
      },
    },
    {
      id: 'watch-1',
      type: 'watchNode',
      position: { x: 400, y: 0 },
      data: {
        label: 'Watch',
      },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'ifc-1',
      target: 'filter-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e2',
      source: 'filter-1',
      target: 'watch-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
}

export const mockComplexWorkflow: { nodes: Node[]; edges: Edge[] } = {
  nodes: [
    {
      id: 'ifc-1',
      type: 'ifcNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'IFC File',
        file: null,
      },
    },
    {
      id: 'geometry-1',
      type: 'geometryNode',
      position: { x: 200, y: 0 },
      data: {
        label: 'Extract Geometry',
        properties: {
          elementType: 'walls',
          includeOpenings: true,
        },
      },
    },
    {
      id: 'quantity-1',
      type: 'quantityNode',
      position: { x: 200, y: 150 },
      data: {
        label: 'Calculate Quantities',
        properties: {
          quantityType: 'area',
          groupBy: 'class',
        },
      },
    },
    {
      id: 'property-1',
      type: 'propertyNode',
      position: { x: 400, y: 0 },
      data: {
        label: 'Get Property',
        properties: {
          propertyName: 'IsExternal',
          action: 'get',
          targetPset: 'Pset_WallCommon',
        },
      },
    },
    {
      id: 'export-1',
      type: 'exportNode',
      position: { x: 600, y: 0 },
      data: {
        label: 'Export CSV',
        properties: {
          format: 'csv',
          fileName: 'export',
        },
      },
    },
    {
      id: 'watch-1',
      type: 'watchNode',
      position: { x: 400, y: 150 },
      data: {
        label: 'Watch Quantities',
      },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'ifc-1',
      target: 'geometry-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e2',
      source: 'ifc-1',
      target: 'quantity-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e3',
      source: 'geometry-1',
      target: 'property-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e4',
      source: 'property-1',
      target: 'export-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e5',
      source: 'quantity-1',
      target: 'watch-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
}

export const mockWorkflowWithCycle: { nodes: Node[]; edges: Edge[] } = {
  nodes: [
    {
      id: 'node-1',
      type: 'ifcNode',
      position: { x: 0, y: 0 },
      data: { label: 'Node 1' },
    },
    {
      id: 'node-2',
      type: 'filterNode',
      position: { x: 200, y: 0 },
      data: { label: 'Node 2' },
    },
    {
      id: 'node-3',
      type: 'transformNode',
      position: { x: 400, y: 0 },
      data: { label: 'Node 3' },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e2',
      source: 'node-2',
      target: 'node-3',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e3',
      source: 'node-3',
      target: 'node-2', // Creates cycle
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
}

export const mockPythonWorkflow: { nodes: Node[]; edges: Edge[] } = {
  nodes: [
    {
      id: 'ifc-1',
      type: 'ifcNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'IFC File',
        file: null,
      },
    },
    {
      id: 'python-1',
      type: 'pythonNode',
      position: { x: 200, y: 0 },
      data: {
        label: 'Python Script',
        properties: {
          code: '# Test script\nresult = len(input_data.elements) if input_data else 0',
        },
      },
    },
    {
      id: 'export-1',
      type: 'exportNode',
      position: { x: 400, y: 0 },
      data: {
        label: 'Export',
        properties: {
          format: 'json',
          fileName: 'result',
        },
      },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'ifc-1',
      target: 'python-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e2',
      source: 'python-1',
      target: 'export-1',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
}


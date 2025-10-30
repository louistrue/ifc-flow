import { describe, it, expect } from 'vitest'
import {
  extractGeometry,
  filterElements,
  transformElements,
} from '@/lib/ifc-utils'
import { mockIfcModel, mockEmptyModel } from '../../fixtures/test-models'
import { mockElements } from '../../fixtures/test-elements'

describe('Element Operations', () => {
  describe('extractGeometry', () => {
    it('should return all elements when elementType is "all"', () => {
      const result = extractGeometry(mockIfcModel, 'all', true)
      expect(result).toEqual(mockIfcModel.elements)
      expect(result.length).toBe(mockIfcModel.elements.length)
    })

    it('should filter elements by type', () => {
      const result = extractGeometry(mockIfcModel, 'walls', true)
      const wallElements = mockIfcModel.elements.filter(
        (el) => el.type.toUpperCase() === 'IFCWALL'
      )
      expect(result).toEqual(wallElements)
    })

    it('should filter slabs correctly', () => {
      const result = extractGeometry(mockIfcModel, 'slabs', true)
      const slabElements = mockIfcModel.elements.filter(
        (el) => el.type.toUpperCase() === 'IFCSLAB'
      )
      expect(result).toEqual(slabElements)
    })

    it('should filter columns correctly', () => {
      const modelWithColumns = {
        ...mockIfcModel,
        elements: [
          ...mockIfcModel.elements,
          {
            id: 'column-1',
            expressId: 3001,
            type: 'IfcColumn',
            properties: { Name: 'Column 1' },
          },
        ],
      }
      const result = extractGeometry(modelWithColumns, 'columns', true)
      expect(result.length).toBe(1)
      expect(result[0].type).toBe('IfcColumn')
    })

    it('should exclude openings when includeOpenings is false', () => {
      const modelWithOpenings = {
        ...mockIfcModel,
        elements: [
          ...mockIfcModel.elements,
          {
            id: 'opening-1',
            expressId: 5001,
            type: 'IfcOpeningElement',
            properties: { Name: 'Opening 1' },
          },
        ],
      }
      const result = extractGeometry(modelWithOpenings, 'all', false)
      const hasOpenings = result.some((el) =>
        el.type.toUpperCase().includes('OPENING')
      )
      expect(hasOpenings).toBe(false)
    })

    it('should include openings when includeOpenings is true', () => {
      const modelWithOpenings = {
        ...mockIfcModel,
        elements: [
          ...mockIfcModel.elements,
          {
            id: 'opening-1',
            expressId: 5001,
            type: 'IfcOpeningElement',
            properties: { Name: 'Opening 1' },
          },
        ],
      }
      const result = extractGeometry(modelWithOpenings, 'all', true)
      const hasOpenings = result.some((el) =>
        el.type.toUpperCase().includes('OPENING')
      )
      expect(hasOpenings).toBe(true)
    })

    it('should handle empty model', () => {
      const result = extractGeometry(mockEmptyModel, 'all', true)
      expect(result).toEqual([])
    })

    it('should handle model with no elements', () => {
      const emptyModel = { ...mockIfcModel, elements: [] }
      const result = extractGeometry(emptyModel, 'all', true)
      expect(result).toEqual([])
    })

    it('should map user-friendly types to IFC types correctly', () => {
      const modelWithVariousTypes = {
        ...mockIfcModel,
        elements: [
          {
            id: 'wall-1',
            expressId: 1001,
            type: 'IfcWallStandardCase',
            properties: { Name: 'Wall Standard Case' },
          },
          {
            id: 'beam-1',
            expressId: 4001,
            type: 'IfcBeam',
            properties: { Name: 'Beam 1' },
          },
          {
            id: 'door-1',
            expressId: 5001,
            type: 'IfcDoor',
            properties: { Name: 'Door 1' },
          },
        ],
      }

      const wallResult = extractGeometry(modelWithVariousTypes, 'walls', true)
      expect(wallResult.length).toBe(1)
      expect(wallResult[0].type).toMatch(/IFCWALL/i)

      const beamResult = extractGeometry(modelWithVariousTypes, 'beams', true)
      expect(beamResult.length).toBe(1)
      expect(beamResult[0].type).toBe('IfcBeam')

      const doorResult = extractGeometry(modelWithVariousTypes, 'doors', true)
      expect(doorResult.length).toBe(1)
      expect(doorResult[0].type).toBe('IfcDoor')
    })
  })

  describe('filterElements', () => {
    it('should filter by direct property equals', () => {
      const elements = mockElements
      const result = filterElements(elements, 'Name', 'equals', 'Wall 1')
      expect(result.length).toBe(1)
      expect(result[0].properties.Name).toBe('Wall 1')
    })

    it('should filter by property contains', () => {
      const elements = mockElements
      const result = filterElements(elements, 'Name', 'contains', 'Wall')
      expect(result.length).toBe(2) // Both Wall 1 and Wall 2
      result.forEach((el) => {
        expect(el.properties.Name).toContain('Wall')
      })
    })

    it('should filter by property startsWith', () => {
      const elements = mockElements
      const result = filterElements(elements, 'Name', 'startsWith', 'Wall')
      expect(result.length).toBe(2)
      result.forEach((el) => {
        expect(el.properties.Name).toMatch(/^Wall/)
      })
    })

    it('should filter by property endsWith', () => {
      const elements = mockElements
      const result = filterElements(elements, 'Name', 'endsWith', '1')
      expect(result.length).toBeGreaterThan(0)
      result.forEach((el) => {
        expect(el.properties.Name).toMatch(/1$/)
      })
    })

    it('should filter by pset property', () => {
      const elements = mockElements
      const result = filterElements(
        elements,
        'Pset_WallCommon.IsExternal',
        'equals',
        'true'
      )
      expect(result.length).toBeGreaterThan(0)
      result.forEach((el) => {
        expect(el.psets?.Pset_WallCommon?.IsExternal).toBe(true)
      })
    })

    it('should filter by nested pset property', () => {
      const elements = mockElements
      const result = filterElements(
        elements,
        'Pset_WallCommon.FireRating',
        'equals',
        'A'
      )
      expect(result.length).toBeGreaterThan(0)
      result.forEach((el) => {
        expect(el.psets?.Pset_WallCommon?.FireRating).toBe('A')
      })
    })

    it('should return empty array for no matches', () => {
      const elements = mockElements
      const result = filterElements(elements, 'Name', 'equals', 'NonExistent')
      expect(result).toEqual([])
    })

    it('should handle undefined or empty elements', () => {
      expect(filterElements([], 'Name', 'equals', 'Test')).toEqual([])
      expect(filterElements(undefined as any, 'Name', 'equals', 'Test')).toEqual([])
    })

    it('should handle elements without the property', () => {
      const elementsWithoutProperty = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { Name: 'Wall 1' },
        },
      ]
      const result = filterElements(
        elementsWithoutProperty,
        'NonExistentProperty',
        'equals',
        'value'
      )
      expect(result).toEqual([])
    })

    it('should handle elements without psets', () => {
      const elementsWithoutPsets = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { Name: 'Wall 1' },
        },
      ]
      const result = filterElements(
        elementsWithoutPsets,
        'Pset_WallCommon.IsExternal',
        'equals',
        'true'
      )
      expect(result).toEqual([])
    })
  })

  describe('transformElements', () => {
    it('should apply translation correctly', () => {
      const elements = mockElements
      const translation: [number, number, number] = [10, 20, 30]
      const result = transformElements(elements, translation, [0, 0, 0], [1, 1, 1])

      expect(result.length).toBe(elements.length)
      result.forEach((el, index) => {
        expect(el.transformedGeometry).toBeDefined()
        expect(el.transformedGeometry?.translation).toEqual(translation)
        expect(el.transformedGeometry?.rotation).toEqual([0, 0, 0])
        expect(el.transformedGeometry?.scale).toEqual([1, 1, 1])
      })
    })

    it('should apply rotation correctly', () => {
      const elements = mockElements
      const rotation: [number, number, number] = [45, 90, 180]
      const result = transformElements(elements, [0, 0, 0], rotation, [1, 1, 1])

      expect(result.length).toBe(elements.length)
      result.forEach((el) => {
        expect(el.transformedGeometry?.rotation).toEqual(rotation)
      })
    })

    it('should apply scale correctly', () => {
      const elements = mockElements
      const scale: [number, number, number] = [2, 2, 2]
      const result = transformElements(elements, [0, 0, 0], [0, 0, 0], scale)

      expect(result.length).toBe(elements.length)
      result.forEach((el) => {
        expect(el.transformedGeometry?.scale).toEqual(scale)
      })
    })

    it('should combine all transformations', () => {
      const elements = mockElements
      const translation: [number, number, number] = [10, 20, 30]
      const rotation: [number, number, number] = [45, 90, 180]
      const scale: [number, number, number] = [2, 2, 2]

      const result = transformElements(elements, translation, rotation, scale)

      expect(result.length).toBe(elements.length)
      result.forEach((el) => {
        expect(el.transformedGeometry?.translation).toEqual(translation)
        expect(el.transformedGeometry?.rotation).toEqual(rotation)
        expect(el.transformedGeometry?.scale).toEqual(scale)
      })
    })

    it('should handle empty element array', () => {
      const result = transformElements([], [0, 0, 0], [0, 0, 0], [1, 1, 1])
      expect(result).toEqual([])
    })

    it('should handle undefined elements', () => {
      const result = transformElements(undefined as any, [0, 0, 0], [0, 0, 0], [1, 1, 1])
      expect(result).toEqual([])
    })

    it('should preserve original element properties', () => {
      const elements = mockElements
      const result = transformElements(elements, [10, 20, 30], [0, 0, 0], [1, 1, 1])

      result.forEach((el, index) => {
        expect(el.id).toBe(elements[index].id)
        expect(el.type).toBe(elements[index].type)
        expect(el.properties).toEqual(elements[index].properties)
        expect(el.psets).toEqual(elements[index].psets)
      })
    })

    it('should use default values when not provided', () => {
      const elements = mockElements
      const result = transformElements(elements)

      result.forEach((el) => {
        expect(el.transformedGeometry?.translation).toEqual([0, 0, 0])
        expect(el.transformedGeometry?.rotation).toEqual([0, 0, 0])
        expect(el.transformedGeometry?.scale).toEqual([1, 1, 1])
      })
    })

    it('should not modify original elements', () => {
      const elements = mockElements
      const originalElements = JSON.parse(JSON.stringify(elements))
      const result = transformElements(elements, [10, 20, 30], [0, 0, 0], [1, 1, 1])

      // Original elements should not have transformedGeometry
      elements.forEach((el) => {
        expect(el.transformedGeometry).toBeUndefined()
      })

      // Result elements should have transformedGeometry
      result.forEach((el) => {
        expect(el.transformedGeometry).toBeDefined()
      })

      // But other properties should match
      originalElements.forEach((originalEl: any, index: number) => {
        const resultEl = result[index]
        expect(resultEl.id).toBe(originalEl.id)
        expect(resultEl.type).toBe(originalEl.type)
      })
    })
  })
})


import { describe, it, expect } from 'vitest'
import { manageProperties } from '@/lib/ifc-utils'
import { mockElements } from '../../fixtures/test-elements'

describe('Property Operations', () => {
  describe('manageProperties - Get Action', () => {
    it('should find property in direct properties', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      expect(result.length).toBe(elements.length)
      result.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
        if (el.properties?.Name) {
          expect(el.propertyInfo?.exists).toBe(true)
          expect(el.propertyInfo?.name).toBe('Name')
          expect(el.propertyInfo?.value).toBe(el.properties.Name)
        }
      })
    })

    it('should find property in psets', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'IsExternal',
        targetPset: 'Pset_WallCommon',
      })

      const wallElements = result.filter((el) => el.type === 'IfcWall')
      wallElements.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
        if (el.psets?.Pset_WallCommon?.IsExternal !== undefined) {
          expect(el.propertyInfo?.exists).toBe(true)
          expect(el.propertyInfo?.name).toBe('IsExternal')
          expect(el.propertyInfo?.psetName).toBe('Pset_WallCommon')
          expect(el.propertyInfo?.value).toBe(el.psets.Pset_WallCommon.IsExternal)
        }
      })
    })

    it('should search all psets when targetPset is "any"', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'IsExternal',
        targetPset: 'any',
      })

      result.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
        // PropertyInfo should be set even if not found
        expect(el.propertyInfo?.name).toBe('IsExternal')
      })
    })

    it('should find IsExternal with case variations', () => {
      const elementsWithCaseVariations = [
        {
          id: 'wall-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
          psets: {
            Pset_WallCommon: {
              isExternal: true, // lowercase
            },
          },
        },
        {
          id: 'wall-2',
          expressId: 1002,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-2', Name: 'Wall 2' },
          psets: {
            Pset_WallCommon: {
              ISEXTERNAL: false, // uppercase
            },
          },
        },
      ]

      const result = manageProperties(elementsWithCaseVariations, {
        action: 'get',
        propertyName: 'IsExternal',
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].propertyInfo?.exists).toBe(true)
      expect(result[0].propertyInfo?.value).toBe(true)
      expect(result[1].propertyInfo?.exists).toBe(true)
      expect(result[1].propertyInfo?.value).toBe(false)
    })

    it('should return propertyInfo with exists flag', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'NonExistentProperty',
        targetPset: 'any',
      })

      result.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
        expect(el.propertyInfo?.exists).toBe(false)
        expect(el.propertyInfo?.value).toBeNull()
      })
    })

    it('should handle nested property paths', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'Pset_WallCommon:IsExternal',
        targetPset: 'any',
      })

      const wallElements = result.filter((el) => el.type === 'IfcWall')
      wallElements.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
        expect(el.propertyInfo?.name).toBe('IsExternal')
        if (el.psets?.Pset_WallCommon?.IsExternal !== undefined) {
          expect(el.propertyInfo?.exists).toBe(true)
          expect(el.propertyInfo?.psetName).toBe('Pset_WallCommon')
        }
      })
    })

    it('should handle empty property name', () => {
      const elements = mockElements
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: '',
        targetPset: 'any',
      })

      expect(result).toEqual(elements)
      result.forEach((el) => {
        expect(el.propertyInfo).toBeUndefined()
      })
    })

    it('should handle empty elements array', () => {
      const result = manageProperties([], {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      expect(result).toEqual([])
    })

    it('should check quantity sets when targetPset is "any"', () => {
      const elementsWithQto = [
        {
          id: 'slab-1',
          expressId: 2001,
          type: 'IfcSlab',
          properties: { GlobalId: 'guid-1', Name: 'Slab 1' },
          qtos: {
            Qto_SlabBaseQuantities: {
              Area: 100.5,
            },
          },
        },
      ]

      const result = manageProperties(elementsWithQto, {
        action: 'get',
        propertyName: 'Area',
        targetPset: 'any',
      })

      expect(result[0].propertyInfo?.exists).toBe(true)
      expect(result[0].propertyInfo?.value).toBe(100.5)
      expect(result[0].propertyInfo?.psetName).toBe('Qto_SlabBaseQuantities')
    })
  })

  describe('manageProperties - Set Action', () => {
    it('should set property in specified pset', () => {
      const elements = mockElements.slice(0, 1) // Single element
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NewProperty',
        propertyValue: 'NewValue',
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.NewProperty).toBe('NewValue')
      expect(result[0].properties?.NewProperty).toBe('NewValue')
      expect(result[0].propertyInfo?.exists).toBe(true)
      expect(result[0].propertyInfo?.value).toBe('NewValue')
    })

    it('should create pset if not exists', () => {
      const elements = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
        },
      ]

      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NewProperty',
        propertyValue: 'NewValue',
        targetPset: 'NewPset',
      })

      expect(result[0].psets).toBeDefined()
      expect(result[0].psets?.NewPset).toBeDefined()
      expect(result[0].psets?.NewPset?.NewProperty).toBe('NewValue')
    })

    it('should update direct properties too', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NewProperty',
        propertyValue: 'NewValue',
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].properties?.NewProperty).toBe('NewValue')
      expect(result[0].psets?.Pset_WallCommon?.NewProperty).toBe('NewValue')
    })

    it('should handle mapping objects (element-specific values)', () => {
      const elements = [
        {
          id: 'wall-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
        },
        {
          id: 'wall-2',
          expressId: 1002,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-2', Name: 'Wall 2' },
        },
      ]

      const mapping = {
        mappings: {
          'guid-1': 'Value1',
          'guid-2': 'Value2',
        },
      }

      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NewProperty',
        propertyValue: mapping,
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.NewProperty).toBe('Value1')
      expect(result[1].psets?.Pset_WallCommon?.NewProperty).toBe('Value2')
    })

    it('should skip elements not in mapping', () => {
      const elements = [
        {
          id: 'wall-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
        },
        {
          id: 'wall-2',
          expressId: 1002,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-2', Name: 'Wall 2' },
        },
      ]

      const mapping = {
        mappings: {
          'guid-1': 'Value1',
          // guid-2 not in mapping
        },
      }

      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NewProperty',
        propertyValue: mapping,
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.NewProperty).toBe('Value1')
      expect(result[1].psets?.Pset_WallCommon?.NewProperty).toBeUndefined()
    })

    it('should handle colon notation in property name', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'Pset_WallCommon:NewProperty',
        propertyValue: 'NewValue',
        targetPset: 'any', // Should be overridden by colon notation
      })

      expect(result[0].psets?.Pset_WallCommon?.NewProperty).toBe('NewValue')
      expect(result[0].propertyInfo?.psetName).toBe('Pset_WallCommon')
    })

    it('should handle numeric values', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'NumericProperty',
        propertyValue: 42,
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.NumericProperty).toBe(42)
    })

    it('should handle boolean values', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'BooleanProperty',
        propertyValue: true,
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.BooleanProperty).toBe(true)
    })
  })

  describe('manageProperties - Remove Action', () => {
    it('should remove from direct properties', () => {
      const elements = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: {
            GlobalId: 'guid-1',
            Name: 'Wall 1',
            PropertyToRemove: 'Value',
          },
        },
      ]

      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'PropertyToRemove',
        targetPset: 'any',
      })

      expect(result[0].properties?.PropertyToRemove).toBeUndefined()
      expect(result[0].propertyInfo?.exists).toBe(false)
    })

    it('should remove from specific pset', () => {
      const elements = [
        {
          id: 'wall-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
          psets: {
            Pset_WallCommon: {
              IsExternal: true,
              PropertyToRemove: 'Value',
            },
          },
        },
      ]

      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'PropertyToRemove',
        targetPset: 'Pset_WallCommon',
      })

      expect(result[0].psets?.Pset_WallCommon?.PropertyToRemove).toBeUndefined()
      expect(result[0].psets?.Pset_WallCommon?.IsExternal).toBe(true) // Other property preserved
    })

    it('should remove from all psets when targetPset is "any"', () => {
      const elements = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: { GlobalId: 'guid-1', Name: 'Wall 1' },
          psets: {
            Pset_WallCommon: {
              PropertyToRemove: 'Value1',
            },
            Pset_Custom: {
              PropertyToRemove: 'Value2',
            },
          },
        },
      ]

      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'PropertyToRemove',
        targetPset: 'any',
      })

      expect(result[0].psets?.Pset_WallCommon?.PropertyToRemove).toBeUndefined()
      expect(result[0].psets?.Pset_Custom?.PropertyToRemove).toBeUndefined()
    })

    it('should handle non-existent properties gracefully', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'NonExistentProperty',
        targetPset: 'any',
      })

      expect(result[0].propertyInfo?.exists).toBe(false)
      // No error should be thrown
    })

    it('should also remove from qtos when targetPset is "any"', () => {
      const elements = [
        {
          id: 'slab-1',
          expressId: 2001,
          type: 'IfcSlab',
          properties: { GlobalId: 'guid-1', Name: 'Slab 1' },
          qtos: {
            Qto_SlabBaseQuantities: {
              Area: 100.5,
              PropertyToRemove: 'Value',
            },
          },
        },
      ]

      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'PropertyToRemove',
        targetPset: 'any',
      })

      expect(result[0].qtos?.Qto_SlabBaseQuantities?.PropertyToRemove).toBeUndefined()
      expect(result[0].qtos?.Qto_SlabBaseQuantities?.Area).toBe(100.5) // Other property preserved
    })

    it('should preserve other properties when removing', () => {
      const elements = [
        {
          id: 'wall-1',
          expressId: 1001,
          type: 'IfcWall',
          properties: {
            GlobalId: 'guid-1',
            Name: 'Wall 1',
            PropertyToRemove: 'Remove',
            PropertyToKeep: 'Keep',
          },
          psets: {
            Pset_WallCommon: {
              IsExternal: true,
              PropertyToRemove: 'Remove',
              FireRating: 'A',
            },
          },
        },
      ]

      const result = manageProperties(elements, {
        action: 'remove',
        propertyName: 'PropertyToRemove',
        targetPset: 'any',
      })

      expect(result[0].properties?.PropertyToRemove).toBeUndefined()
      expect(result[0].properties?.PropertyToKeep).toBe('Keep')
      expect(result[0].psets?.Pset_WallCommon?.PropertyToRemove).toBeUndefined()
      expect(result[0].psets?.Pset_WallCommon?.IsExternal).toBe(true)
      expect(result[0].psets?.Pset_WallCommon?.FireRating).toBe('A')
    })
  })

  describe('manageProperties - Edge Cases', () => {
    it('should handle undefined elements', () => {
      const result = manageProperties(undefined as any, {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      expect(result).toEqual([])
    })

    it('should handle null elements', () => {
      const result = manageProperties(null as any, {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      expect(result).toEqual([])
    })

    it('should handle elements without properties', () => {
      const elementsWithoutProperties = [
        {
          id: 'element-1',
          expressId: 1001,
          type: 'IfcWall',
        },
      ]

      const result = manageProperties(elementsWithoutProperties as any, {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      expect(result[0].propertyInfo?.exists).toBe(false)
    })

    it('should handle dot notation in property name', () => {
      const elements = mockElements.slice(0, 1)
      const result = manageProperties(elements, {
        action: 'set',
        propertyName: 'CustomPset.NewProperty',
        propertyValue: 'NewValue',
        targetPset: 'any',
      })

      // Dot notation should be treated as property name, not pset:property
      expect(result[0].properties?.['CustomPset.NewProperty']).toBe('NewValue')
    })

    it('should preserve original elements when getting', () => {
      const elements = mockElements
      const originalElements = JSON.parse(JSON.stringify(elements))
      const result = manageProperties(elements, {
        action: 'get',
        propertyName: 'Name',
        targetPset: 'any',
      })

      // Original elements should not have propertyInfo
      elements.forEach((el, index) => {
        expect(el.propertyInfo).toBeUndefined()
        expect(el.properties).toEqual(originalElements[index].properties)
      })

      // Result elements should have propertyInfo
      result.forEach((el) => {
        expect(el.propertyInfo).toBeDefined()
      })
    })
  })
})


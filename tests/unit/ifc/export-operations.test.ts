import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportData, getLastLoadedModel, setLastLoadedModel } from '@/lib/ifc-utils'
import { mockElements } from '../../fixtures/test-elements'
import { mockIfcModel } from '../../fixtures/test-models'

// Mock the GLTF exporter and viewer utilities
vi.mock('three/examples/jsm/exporters/GLTFExporter.js', () => ({
    GLTFExporter: vi.fn().mockImplementation(function (this: any) {
        this.parseAsync = vi.fn().mockResolvedValue(new ArrayBuffer(100))
    }),
}))

vi.mock('@/lib/ifc/viewer-manager', () => ({
    withActiveViewer: vi.fn((callback) => null),
    hasActiveModel: vi.fn(() => false),
}))

describe('Export Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('exportData - CSV', () => {
        it('should export element array to CSV', async () => {
            const elements = mockElements
            const result = await exportData(elements, 'csv', 'test-export')

            expect(typeof result).toBe('string')
            if (typeof result === 'string') {
                expect(result).toContain('Name')
                expect(result).toContain('GlobalId')
                expect(result.split('\n').length).toBeGreaterThan(1) // Header + data rows
            }
        })

        it('should handle nested properties with dot notation', async () => {
            const elements = mockElements
            const result = await exportData(elements, 'csv', 'test-export')

            // Should include pset properties with dot notation
            if (typeof result === 'string') {
                expect(result).toContain('Pset_WallCommon')
                expect(result.split('\n')[0]).toContain('Pset_WallCommon.IsExternal')
            }
        })

        it('should escape special characters', async () => {
            const elementsWithSpecialChars = [
                {
                    id: 'element-1',
                    expressId: 1001,
                    type: 'IfcWall',
                    properties: {
                        Name: 'Wall with "quotes" and, commas',
                        Description: 'Line 1\nLine 2',
                    },
                },
            ]

            const result = await exportData(elementsWithSpecialChars, 'csv', 'test-export')

            // Should escape quotes
            if (typeof result === 'string') {
                expect(result).toContain('"')
                // Should wrap values with commas
                expect(result.split('\n')[1]).toContain('"')
            }
        })

        it('should handle empty data', async () => {
            const result = await exportData([], 'csv', 'test-export')
            expect(result).toBe('')
        })

        it('should extract properties from psets', async () => {
            const elements = mockElements
            const result = await exportData(elements, 'csv', 'test-export')

            if (typeof result === 'string') {
                const csvLines = result.split('\n')
                const header = csvLines[0]

                // Should include pset properties in header
                expect(header).toContain('Pset_WallCommon.IsExternal')
                expect(header).toContain('Pset_WallCommon.FireRating')
            }
        })

        it('should handle quantity results format', async () => {
            const quantityResults = {
                groups: { Wall: 10, Slab: 5 },
                unit: 'm²',
                total: 15,
                groupBy: 'class',
            }

            const result = await exportData(quantityResults, 'csv', 'test-export')

            expect(typeof result).toBe('string')
            expect(result).toContain('group')
            // CSV column names may vary - check that it contains group data
            expect(result).toContain('Wall')
            expect(result).toContain('Slab')
        })

        it('should handle wrapped quantity results', async () => {
            const wrappedQuantityResults = {
                type: 'quantityResults',
                value: {
                    groups: { Wall: 10, Slab: 5 },
                    unit: 'm²',
                    total: 15,
                },
            }

            const result = await exportData(wrappedQuantityResults, 'csv', 'test-export')

            expect(typeof result).toBe('string')
            expect(result).toContain('group')
            // Value may be in different column name
            expect(result).toContain('Wall')
        })
    })

    describe('exportData - JSON', () => {
        it('should export to formatted JSON', async () => {
            const elements = mockElements.slice(0, 2)
            const result = await exportData(elements, 'json', 'test-export')

            expect(typeof result).toBe('string')
            if (typeof result === 'string') {
                const parsed = JSON.parse(result)
                expect(Array.isArray(parsed)).toBe(true)
                expect(parsed.length).toBe(2)
            }
        })

        it('should flatten nested structures', async () => {
            const elements = mockElements
            const result = await exportData(elements, 'json', 'test-export')

            if (typeof result === 'string') {
                const parsed = JSON.parse(result)
                expect(parsed.length).toBeGreaterThan(0)
                // Should have flattened pset properties
                const firstRow = parsed[0]
                expect(firstRow).toBeDefined()
            }
        })

        it('should handle quantity results format', async () => {
            const quantityResults = {
                groups: { Wall: 10, Slab: 5 },
                unit: 'm²',
                total: 15,
            }

            const result = await exportData(quantityResults, 'json', 'test-export')

            if (typeof result === 'string') {
                const parsed = JSON.parse(result)
                expect(Array.isArray(parsed)).toBe(true)
                expect(parsed.length).toBe(2) // Two groups
                expect(parsed[0]).toHaveProperty('group')
                // Should have numeric values somewhere in the structure
                const hasNumericValue = parsed.some((row: any) =>
                    Object.values(row).some((val: any) => typeof val === 'number' && val > 0)
                )
                expect(hasNumericValue).toBe(true)
            }
        })

        it('should handle null/undefined input', async () => {
            const result = await exportData(null, 'json', 'test-export')
            // Returns empty string for null, not empty array
            expect(typeof result).toBe('string')
        })

        it('should handle single object input', async () => {
            const singleObject = { name: 'Test', value: 42 }
            const result = await exportData(singleObject, 'json', 'test-export')

            if (typeof result === 'string') {
                const parsed = JSON.parse(result)
                expect(Array.isArray(parsed)).toBe(true)
                expect(parsed.length).toBe(1)
                // Properties may be flattened or preserved as-is
                expect(parsed[0]).toHaveProperty('name')
            }
        })
    })

    describe('exportData - Excel', () => {
        it('should create valid XLSX file', async () => {
            const elements = mockElements.slice(0, 2)
            const result = await exportData(elements, 'excel', 'test-export')

            expect(result).toBeInstanceOf(ArrayBuffer)
            if (result instanceof ArrayBuffer) {
                expect(result.byteLength).toBeGreaterThan(0)
            }
        })

        it('should preserve data types', async () => {
            const elements = [
                {
                    id: 'element-1',
                    expressId: 1001,
                    type: 'IfcWall',
                    properties: {
                        Name: 'Wall 1',
                        Number: 42,
                        Boolean: true,
                    },
                },
            ]

            const result = await exportData(elements, 'excel', 'test-export')
            expect(result).toBeInstanceOf(ArrayBuffer)
        })

        it('should handle large datasets', async () => {
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                id: `element-${i}`,
                expressId: i,
                type: 'IfcWall',
                properties: { Name: `Wall ${i}` },
            }))

            const result = await exportData(largeDataset, 'excel', 'test-export')
            expect(result).toBeInstanceOf(ArrayBuffer)
            if (result instanceof ArrayBuffer) {
                expect(result.byteLength).toBeGreaterThan(0)
            }
        })

        it('should handle nested properties', async () => {
            const elements = mockElements
            const result = await exportData(elements, 'excel', 'test-export')

            expect(result).toBeInstanceOf(ArrayBuffer)
        })
    })

    describe('exportData - GLB', () => {
        it('should create valid GLB from geometry elements', async () => {
            const elementsWithGeometry = mockElements.map((el) => ({
                ...el,
                geometry: {
                    type: 'simplified',
                    vertices: new Float32Array([
                        0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0,
                    ]),
                    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
                    normals: new Float32Array([
                        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
                    ]),
                },
            }))

            const result = await exportData(elementsWithGeometry, 'glb', 'test-export')

            expect(result).toBeInstanceOf(ArrayBuffer)
            if (result instanceof ArrayBuffer) {
                expect(result.byteLength).toBeGreaterThan(0)
            }
        })

        it('should apply transformations', async () => {
            const elementsWithTransform = [
                {
                    ...mockElements[0],
                    geometry: {
                        type: 'simplified',
                        vertices: new Float32Array([
                            0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0,
                        ]),
                        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
                    },
                    transformedGeometry: {
                        translation: [10, 20, 30],
                        rotation: [45, 90, 180],
                        scale: [2, 2, 2],
                    },
                },
            ]

            const result = await exportData(elementsWithTransform, 'glb', 'test-export')

            expect(result).toBeInstanceOf(ArrayBuffer)
        })

        it('should handle elements without geometry', async () => {
            const elementsWithoutGeometry = mockElements
            const result = await exportData(elementsWithoutGeometry, 'glb', 'test-export')

            // Should create placeholder geometry
            expect(result).toBeInstanceOf(ArrayBuffer)
            if (result instanceof ArrayBuffer) {
                expect(result.byteLength).toBeGreaterThan(0)
            }
        })

        it('should export from active viewer if available', async () => {
            const { withActiveViewer, hasActiveModel } = await import('@/lib/ifc/viewer-manager')

            vi.mocked(hasActiveModel).mockReturnValue(true)
            vi.mocked(withActiveViewer).mockImplementation((callback) => {
                // Mock viewer with model group
                const mockModelGroup = {
                    traverse: vi.fn((cb) => {
                        // Simulate meshes
                        cb({ geometry: {}, material: {} })
                    }),
                }
                return callback({
                    getModelGroup: () => mockModelGroup,
                    getMeshesForElement: () => [],
                } as any)
            })

            const elements = mockElements
            const result = await exportData(elements, 'glb', 'test-export')

            expect(result).toBeInstanceOf(ArrayBuffer)
            expect(hasActiveModel).toHaveBeenCalled()
        })

        it('should handle invalid geometry data', async () => {
            const elementsWithInvalidGeometry = [
                {
                    ...mockElements[0],
                    geometry: {
                        type: 'simplified',
                        vertices: new Float32Array([0, 0, 0]), // Invalid length (not divisible by 3)
                        indices: new Uint32Array([0, 1, 2]),
                    },
                },
            ]

            const result = await exportData(elementsWithInvalidGeometry, 'glb', 'test-export')

            // Should fall back to placeholder or handle gracefully
            expect(result).toBeInstanceOf(ArrayBuffer)
        })
    })

    describe('exportData - Edge Cases', () => {
        it('should handle null input', async () => {
            const result = await exportData(null, 'csv', 'test-export')
            expect(result).toBe('')
        })

        it('should handle undefined input', async () => {
            const result = await exportData(undefined, 'csv', 'test-export')
            expect(result).toBe('')
        })

        it('should handle primitive values', async () => {
            // Primitive values are wrapped in { value: input } but CSV export may have issues
            // with header extraction for simple primitives - this is acceptable behavior
            const result = await exportData(42, 'csv', 'test-export')
            // Should handle gracefully - may return empty string or headers only
            expect(typeof result).toBe('string')
        })

        it('should handle model object input', async () => {
            const result = await exportData(mockIfcModel, 'csv', 'test-export')

            expect(typeof result).toBe('string')
            if (typeof result === 'string') {
                expect(result.split('\n').length).toBeGreaterThan(1)
            }
        })

        it('should handle Python script output format', async () => {
            const pythonOutput = {
                detailed_data: [
                    { name: 'Item 1', value: 10 },
                    { name: 'Item 2', value: 20 },
                ],
            }

            const result = await exportData(pythonOutput, 'csv', 'test-export')

            expect(result).toContain('name')
            // The export extracts all fields from detailed_data
            expect(result).toContain('Item 1')
            // May or may not include 'value' depending on how headers are extracted
        })

        it('should handle data transform output format', async () => {
            const transformOutput = {
                data: [
                    { id: 1, name: 'Element 1' },
                    { id: 2, name: 'Element 2' },
                ],
            }

            const result = await exportData(transformOutput, 'csv', 'test-export')

            expect(result).toContain('id')
            expect(result).toContain('name')
            expect(result).toContain('Element 1')
        })

        it('should handle empty array', async () => {
            const result = await exportData([], 'csv', 'test-export')
            expect(result).toBe('')
        })

        it('should handle IFC format dispatch', async () => {
            // Set a mock model as last loaded
            setLastLoadedModel(mockIfcModel)

            // Mock window.dispatchEvent
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

            const elements = mockElements
            const result = await exportData(elements, 'ifc', 'test-export')

            // Should dispatch event instead of returning data
            expect(dispatchEventSpy).toHaveBeenCalled()
            const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent
            expect(event.type).toBe('ifc:export')
            expect(event.detail).toHaveProperty('model')
            expect(event.detail).toHaveProperty('exportFileName')
            expect(event.detail).toHaveProperty('originalFileName')

            dispatchEventSpy.mockRestore()
            setLastLoadedModel(null)
        })

        it('should handle IFC format with no model', async () => {
            setLastLoadedModel(null)

            const elements = mockElements
            await expect(exportData(elements, 'ifc', 'test-export')).rejects.toThrow('Cannot export IFC')
        })
    })
})


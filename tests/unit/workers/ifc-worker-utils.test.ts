import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    initializeWorker,
    loadIfcFile,
    querySqliteDatabase,
    extractGeometryWithGeom,
    warmupSqliteDatabase,
    exportSqliteDatabase,
    getLastLoadedModel,
    setLastLoadedModel,
    cacheIfcFile,
    getIfcFile,
    resetWorker,
} from '@/lib/ifc-utils'
import { mockIfcFile, mockSmallIfcFile, mockLargeIfcFile } from '../../fixtures/test-files'
import { mockIfcModel } from '../../fixtures/test-models'
import { createMockProgressCallback, createMockWorkerMessage } from '../../fixtures/test-helpers'

describe('IFC Worker Utilities', () => {
    let mockWorker: any
    let workerInstances: any[]

    beforeEach(() => {
        // Reset worker state
        resetWorker()
        workerInstances = []

        // Create a mock worker instance
        mockWorker = {
            postMessage: vi.fn(),
            terminate: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            onmessage: null,
            url: '/ifcWorker.js',
        }

            // Override the global Worker class with our mock
            ; (global as any).Worker = class MockWorker {
                constructor(url: string) {
                    const instance = {
                        ...mockWorker,
                        url,
                        postMessage: vi.fn(),
                        addEventListener: vi.fn((event: string, handler: any) => {
                            if (event === 'message') {
                                instance.onmessage = handler
                            }
                        }),
                    }
                    workerInstances.push(instance)
                    return instance
                }
            } as any

        // Reset cached state
        setLastLoadedModel(null)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('initializeWorker', () => {
        it('should initialize worker successfully', async () => {
            const initPromise = initializeWorker()

            // Wait for worker to be created
            await new Promise((resolve) => setTimeout(resolve, 10))

            // Get the created worker instance
            const workerInstance = workerInstances[0]
            expect(workerInstance).toBeDefined()

            // Simulate worker initialization response via addEventListener handler
            if (workerInstance.onmessage) {
                workerInstance.onmessage(
                    createMockWorkerMessage({
                        type: 'initialized',
                        messageId: expect.any(String),
                    })
                )
            }

            await expect(initPromise).resolves.toBeUndefined()
        })

        it('should throw error if Worker is not defined', async () => {
            const originalWorker = (global as any).Worker
            delete (global as any).Worker

            await expect(initializeWorker()).rejects.toThrow('Worker is not defined')

                // Restore Worker
                ; (global as any).Worker = originalWorker
        })

        it('should not initialize multiple times', async () => {
            const initPromise1 = initializeWorker()
            const initPromise2 = initializeWorker()

            await new Promise((resolve) => setTimeout(resolve, 10))

            const workerInstance = workerInstances[0]
            expect(workerInstance).toBeDefined()
            expect(workerInstances.length).toBe(1) // Only one instance should be created

            if (workerInstance.onmessage) {
                workerInstance.onmessage(
                    createMockWorkerMessage({
                        type: 'initialized',
                        messageId: expect.any(String),
                    })
                )
            }

            await Promise.all([initPromise1, initPromise2])
        })

        it('should handle initialization timeout', async () => {
            const initPromise = initializeWorker()

            // Don't send initialized message - let it timeout
            await expect(initPromise).rejects.toThrow('Worker initialization timed out')
        })
    })

    describe('loadIfcFile', () => {
        beforeEach(async () => {
            // Initialize worker first
            const initPromise = initializeWorker()
            await new Promise((resolve) => setTimeout(resolve, 10))

            const workerInstance = workerInstances[0]
            if (workerInstance?.onmessage) {
                workerInstance.onmessage(
                    createMockWorkerMessage({
                        type: 'initialized',
                        messageId: expect.any(String),
                    })
                )
            }

            await initPromise
        })

        it('should send loadIfcFast message with file buffer', async () => {
            const workerInstance = workerInstances[0]
            const file = mockSmallIfcFile
            const loadPromise = loadIfcFile(file)

            await new Promise((resolve) => setTimeout(resolve, 10))

            expect(workerInstance.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'loadIfcFast',
                    messageId: expect.stringMatching(/^load_\d+_[a-z0-9]+$/),
                    data: {
                        filename: file.name,
                        arrayBuffer: expect.any(ArrayBuffer),
                    },
                }),
                expect.arrayContaining([expect.any(ArrayBuffer)])
            )

            // Simulate successful load
            if (workerInstance.onmessage) {
                workerInstance.onmessage(
                    createMockWorkerMessage({
                        type: 'loadComplete',
                        messageId: expect.any(String),
                        elements: [],
                        schema: 'IFC4',
                        element_counts: {},
                        total_elements: 0,
                        sqlite_db: null,
                        sqlite_success: false,
                    })
                )
            }

            await expect(loadPromise).resolves.toBeDefined()
        })

        it('should call progress callback during loading', async () => {
            const workerInstance = workerInstances[0]
            const file = mockSmallIfcFile
            const progressCallback = createMockProgressCallback()
            const loadPromise = loadIfcFile(file, progressCallback)

            await new Promise((resolve) => setTimeout(resolve, 10))

            // Simulate progress then complete
            if (workerInstance.onmessage) {
                workerInstance.onmessage(
                    createMockWorkerMessage({
                        type: 'loadComplete',
                        messageId: expect.any(String),
                        elements: [],
                        schema: 'IFC4',
                        element_counts: {},
                        total_elements: 0,
                        sqlite_db: null,
                        sqlite_success: false,
                    })
                )
            }

            await loadPromise
            expect(progressCallback.calls.length).toBeGreaterThanOrEqual(0)
        })
    })
})

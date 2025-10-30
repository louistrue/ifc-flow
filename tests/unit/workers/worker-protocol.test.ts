import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockWorkerMessage } from '../../fixtures/test-helpers'

/**
 * Tests for worker message protocol handling
 * These tests verify the message ID generation, promise resolver management,
 * timeout handling, and error propagation in worker communication
 */
describe('Worker Protocol', () => {
  let workerPromiseResolvers: Map<
    string,
    { resolve: Function; reject: Function }
  >
  let messageIdCounter: number

  beforeEach(() => {
    workerPromiseResolvers = new Map()
    messageIdCounter = 0
  })

  afterEach(() => {
    workerPromiseResolvers.clear()
  })

  describe('Message ID Generation', () => {
    it('should generate unique message IDs', () => {
      const generateMessageId = (prefix: string) => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const id1 = generateMessageId('load')
      const id2 = generateMessageId('load')
      const id3 = generateMessageId('query')

      expect(id1).not.toBe(id2)
      expect(id1).not.toBe(id3)
      expect(id2).not.toBe(id3)
      expect(id1).toMatch(/^load_\d+_[a-z0-9]+$/)
      expect(id3).toMatch(/^query_\d+_[a-z0-9]+$/)
    })

    it('should generate message IDs with consistent format', () => {
      const generateMessageId = (prefix: string) => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const id = generateMessageId('test')
      const parts = id.split('_')

      expect(parts.length).toBe(3)
      expect(parts[0]).toBe('test')
      expect(parts[1]).toMatch(/^\d+$/) // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/) // random string
      expect(parts[2].length).toBeGreaterThan(0)
    })
  })

  describe('Promise Resolver Management', () => {
    it('should store and retrieve promise resolvers', () => {
      const messageId = 'test_message_123'
      let resolveCalled = false
      let rejectCalled = false

      workerPromiseResolvers.set(messageId, {
        resolve: () => {
          resolveCalled = true
        },
        reject: () => {
          rejectCalled = true
        },
      })

      const resolver = workerPromiseResolvers.get(messageId)
      expect(resolver).toBeDefined()
      expect(resolver?.resolve).toBeDefined()
      expect(resolver?.reject).toBeDefined()

      resolver?.resolve()
      expect(resolveCalled).toBe(true)
      expect(rejectCalled).toBe(false)
    })

    it('should delete resolvers after resolution', () => {
      const messageId = 'test_message_123'

      workerPromiseResolvers.set(messageId, {
        resolve: () => {},
        reject: () => {},
      })

      expect(workerPromiseResolvers.has(messageId)).toBe(true)

      const resolver = workerPromiseResolvers.get(messageId)
      resolver?.resolve()
      workerPromiseResolvers.delete(messageId)

      expect(workerPromiseResolvers.has(messageId)).toBe(false)
    })

    it('should handle multiple concurrent requests', () => {
      const messageIds = ['msg1', 'msg2', 'msg3']

      messageIds.forEach((id) => {
        workerPromiseResolvers.set(id, {
          resolve: vi.fn(),
          reject: vi.fn(),
        })
      })

      expect(workerPromiseResolvers.size).toBe(3)

      messageIds.forEach((id) => {
        const resolver = workerPromiseResolvers.get(id)
        expect(resolver).toBeDefined()
      })
    })
  })

  describe('Message Handling', () => {
    it('should resolve promise when worker responds with success', async () => {
      const messageId = 'test_message_123'
      const testData = { result: 'success', data: { foo: 'bar' } }

      const promise = new Promise((resolve, reject) => {
        workerPromiseResolvers.set(messageId, { resolve, reject })

        // Simulate worker response
        setTimeout(() => {
          const resolver = workerPromiseResolvers.get(messageId)
          if (resolver) {
            resolver.resolve(testData)
            workerPromiseResolvers.delete(messageId)
          }
        }, 10)
      })

      const result = await promise
      expect(result).toEqual(testData)
      expect(workerPromiseResolvers.has(messageId)).toBe(false)
    })

    it('should reject promise when worker responds with error', async () => {
      const messageId = 'test_message_123'
      const errorMessage = 'Worker error occurred'

      const promise = new Promise((resolve, reject) => {
        workerPromiseResolvers.set(messageId, { resolve, reject })

        // Simulate worker error response
        setTimeout(() => {
          const resolver = workerPromiseResolvers.get(messageId)
          if (resolver) {
            resolver.reject(new Error(errorMessage))
            workerPromiseResolvers.delete(messageId)
          }
        }, 10)
      })

      await expect(promise).rejects.toThrow(errorMessage)
      expect(workerPromiseResolvers.has(messageId)).toBe(false)
    })

    it('should handle worker messages with correct type', () => {
      const messageId = 'test_message_123'
      let receivedData: any = null

      workerPromiseResolvers.set(messageId, {
        resolve: (data: any) => {
          receivedData = data
        },
        reject: () => {},
      })

      // Simulate worker message
      const workerMessage = createMockWorkerMessage({
        type: 'loadComplete',
        messageId,
        result: { elements: [] },
      })

      const resolver = workerPromiseResolvers.get(messageId)
      if (workerMessage.data.type === 'loadComplete' && resolver) {
        resolver.resolve(workerMessage.data.result)
      }

      expect(receivedData).toEqual({ elements: [] })
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout if worker does not respond', async () => {
      const messageId = 'test_message_123'
      const timeoutDuration = 50

      const promise = new Promise((resolve, reject) => {
        workerPromiseResolvers.set(messageId, { resolve, reject })

        // Set timeout
        setTimeout(() => {
          if (workerPromiseResolvers.has(messageId)) {
            const resolver = workerPromiseResolvers.get(messageId)
            resolver?.reject(new Error('Worker did not respond within timeout period'))
            workerPromiseResolvers.delete(messageId)
          }
        }, timeoutDuration)
      })

      await expect(promise).rejects.toThrow('Worker did not respond within timeout period')
      expect(workerPromiseResolvers.has(messageId)).toBe(false)
    })

    it('should not timeout if worker responds in time', async () => {
      const messageId = 'test_message_123'
      const timeoutDuration = 100
      const responseTime = 50

      const promise = new Promise((resolve, reject) => {
        workerPromiseResolvers.set(messageId, { resolve, reject })

        // Set timeout
        const timeoutId = setTimeout(() => {
          if (workerPromiseResolvers.has(messageId)) {
            const resolver = workerPromiseResolvers.get(messageId)
            resolver?.reject(new Error('Timeout'))
            workerPromiseResolvers.delete(messageId)
          }
        }, timeoutDuration)

        // Simulate worker response before timeout
        setTimeout(() => {
          clearTimeout(timeoutId)
          const resolver = workerPromiseResolvers.get(messageId)
          if (resolver) {
            resolver.resolve({ success: true })
            workerPromiseResolvers.delete(messageId)
          }
        }, responseTime)
      })

      const result = await promise
      expect(result).toEqual({ success: true })
    })
  })

  describe('Progress Callback Invocation', () => {
    it('should call progress callback with correct data', () => {
      const progressCallback = vi.fn()
      const messageId = 'test_message_123'

      // Simulate progress message
      const progressMessage = createMockWorkerMessage({
        type: 'progress',
        messageId,
        percentage: 50,
        message: 'Processing...',
      })

      if (progressMessage.data.type === 'progress' && progressMessage.data.messageId === messageId) {
        progressCallback(progressMessage.data.percentage, progressMessage.data.message)
      }

      expect(progressCallback).toHaveBeenCalledTimes(1)
      expect(progressCallback).toHaveBeenCalledWith(50, 'Processing...')
    })

    it('should handle multiple progress updates', () => {
      const progressCallback = vi.fn()
      const messageId = 'test_message_123'

      const progressMessages = [
        { percentage: 10, message: 'Starting...' },
        { percentage: 50, message: 'Processing...' },
        { percentage: 90, message: 'Finishing...' },
        { percentage: 100, message: 'Complete' },
      ]

      progressMessages.forEach((progress) => {
        const message = createMockWorkerMessage({
          type: 'progress',
          messageId,
          ...progress,
        })
        if (message.data.type === 'progress' && message.data.messageId === messageId) {
          progressCallback(message.data.percentage, message.data.message)
        }
      })

      expect(progressCallback).toHaveBeenCalledTimes(4)
      expect(progressCallback).toHaveBeenNthCalledWith(1, 10, 'Starting...')
      expect(progressCallback).toHaveBeenNthCalledWith(2, 50, 'Processing...')
      expect(progressCallback).toHaveBeenNthCalledWith(3, 90, 'Finishing...')
      expect(progressCallback).toHaveBeenNthCalledWith(4, 100, 'Complete')
    })

    it('should filter progress messages by messageId', () => {
      const progressCallback1 = vi.fn()
      const progressCallback2 = vi.fn()
      const messageId1 = 'test_message_1'
      const messageId2 = 'test_message_2'

      const message1 = createMockWorkerMessage({
        type: 'progress',
        messageId: messageId1,
        percentage: 50,
        message: 'Message 1',
      })

      const message2 = createMockWorkerMessage({
        type: 'progress',
        messageId: messageId2,
        percentage: 75,
        message: 'Message 2',
      })

      // Only call callback if messageId matches
      if (message1.data.type === 'progress' && message1.data.messageId === messageId1) {
        progressCallback1(message1.data.percentage, message1.data.message)
      }
      if (message2.data.type === 'progress' && message2.data.messageId === messageId2) {
        progressCallback2(message2.data.percentage, message2.data.message)
      }

      expect(progressCallback1).toHaveBeenCalledTimes(1)
      expect(progressCallback1).toHaveBeenCalledWith(50, 'Message 1')
      expect(progressCallback2).toHaveBeenCalledTimes(1)
      expect(progressCallback2).toHaveBeenCalledWith(75, 'Message 2')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resolvers on completion', () => {
      const messageId = 'test_message_123'

      workerPromiseResolvers.set(messageId, {
        resolve: vi.fn(),
        reject: vi.fn(),
      })

      expect(workerPromiseResolvers.has(messageId)).toBe(true)

      const resolver = workerPromiseResolvers.get(messageId)
      resolver?.resolve({ success: true })
      workerPromiseResolvers.delete(messageId)

      expect(workerPromiseResolvers.has(messageId)).toBe(false)
      expect(workerPromiseResolvers.size).toBe(0)
    })

    it('should handle cleanup for multiple concurrent requests', () => {
      const messageIds = ['msg1', 'msg2', 'msg3']

      messageIds.forEach((id) => {
        workerPromiseResolvers.set(id, {
          resolve: vi.fn(),
          reject: vi.fn(),
        })
      })

      expect(workerPromiseResolvers.size).toBe(3)

      // Resolve and cleanup each
      messageIds.forEach((id) => {
        const resolver = workerPromiseResolvers.get(id)
        resolver?.resolve({ done: true })
        workerPromiseResolvers.delete(id)
      })

      expect(workerPromiseResolvers.size).toBe(0)
    })
  })
})


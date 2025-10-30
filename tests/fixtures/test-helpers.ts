/**
 * Helper functions for creating test data
 */

/**
 * Creates a mock progress callback for testing
 */
export function createMockProgressCallback() {
  const calls: Array<{ progress: number; message?: string }> = []
  const callback = (progress: number, message?: string) => {
    calls.push({ progress, message })
  }
  callback.calls = calls
  return callback
}

/**
 * Creates a delay for testing async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a mock worker message event
 */
export function createMockWorkerMessage(data: any): MessageEvent {
  return {
    data,
    origin: 'test',
    lastEventId: '',
    source: null,
    ports: [],
    bubbles: false,
    cancelable: false,
    cancelBubble: false,
    composed: false,
    currentTarget: null,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    returnValue: false,
    srcElement: null,
    target: null,
    timeStamp: Date.now(),
    type: 'message',
    initMessageEvent: () => {},
    composedPath: () => [],
    initEvent: () => {},
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    stopPropagation: () => {},
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    CAPTURING_PHASE: 1,
    NONE: 0,
  } as MessageEvent
}

/**
 * Creates a promise that resolves after a delay (for testing timeouts)
 */
export function createDelayedPromise<T>(
  delayMs: number,
  value: T
): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delayMs)
  })
}

/**
 * Creates a promise that rejects after a delay (for testing errors)
 */
export function createDelayedRejection<T>(
  delayMs: number,
  error: Error
): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), delayMs)
  })
}


/**
 * Shared utilities and types for worker handlers
 */

// IndexedDB helpers
export const IDB_NAME = 'ifc-sql-db'
export const IDB_STORE = 'sqlite'

export function idbOpen() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE)
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function idbPut(key: string, bytes: Uint8Array): Promise<void> {
    const db = await idbOpen()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
        tx.objectStore(IDB_STORE).put(bytes, key)
    })
}

export async function idbGet(key: string): Promise<Uint8Array | null> {
    const db = await idbOpen()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const req = tx.objectStore(IDB_STORE).get(key)
        req.onsuccess = () => { const v = req.result || null; db.close(); resolve(v) }
        req.onerror = () => { const e = req.error; db.close(); reject(e) }
    })
}

export async function idbDelete(key: string): Promise<void> {
    const db = await idbOpen()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        const req = tx.objectStore(IDB_STORE).delete(key)
        req.onsuccess = () => { db.close(); resolve() }
        req.onerror = () => { const e = req.error; db.close(); reject(e) }
    })
}

// Fast CRC32 implementation for Uint8Array
export function crc32(uint8: Uint8Array): number {
    let crc = -1 >>> 0
    for (let i = 0; i < uint8.length; i++) {
        crc = (crc ^ uint8[i]) >>> 0
        for (let j = 0; j < 8; j++) {
            const mask = -(crc & 1)
            crc = (crc >>> 1) ^ (0xEDB88320 & mask)
        }
    }
    return (crc ^ (-1 >>> 0)) >>> 0
}

export function computeDbKeyFromBuffer(filename: string, arrayBuffer: ArrayBuffer): string {
    try {
        const u8 = new Uint8Array(arrayBuffer)
        const size = u8.length >>> 0
        const slice = 16 * 1024 * 1024
        const first = u8.subarray(0, Math.min(slice, size))
        const last = size > slice ? u8.subarray(size - slice, size) : first
        const c1 = crc32(first).toString(16)
        const c2 = crc32(last).toString(16)
        return `db:${size}-${c1}-${c2}`
    } catch {
        // Fallback to filename-based key
        return `db:${filename || 'default'}`
    }
}

// Helper to post progress messages
export function postProgress(messageId: string, percentage: number, message?: string) {
    try {
        self.postMessage({
            type: 'progress',
            messageId,
            percentage,
            message,
        })
    } catch (e) {
        // Ignore errors in worker context
    }
}

// Helper to post error messages
export function postError(messageId: string, error: Error) {
    try {
        self.postMessage({
            type: 'error',
            messageId,
            message: error.message,
            stack: error.stack,
        })
    } catch (e) {
        // Ignore errors in worker context
    }
}

// Helper to post any message
export function postMessage(message: any, transfer?: Transferable[]) {
    try {
        if (transfer && transfer.length > 0) {
            (self.postMessage as any)(message, transfer)
        } else {
            (self.postMessage as any)(message)
        }
    } catch (e) {
        // Ignore errors in worker context
    }
}


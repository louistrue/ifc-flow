/**
 * IndexedDB Manager
 * Handles IndexedDB operations for SQLite database persistence
 */

const IDB_NAME = 'ifc-sql-db'
const IDB_STORE = 'sqlite'

export class IndexedDBManager {
  private static instance: IndexedDBManager | null = null

  private constructor() {}

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager()
    }
    return IndexedDBManager.instance
  }

  /**
   * Open IndexedDB database
   */
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
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

  /**
   * Store database bytes in IndexedDB
   */
  async put(key: string, bytes: Uint8Array): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
      tx.objectStore(IDB_STORE).put(bytes, key)
    })
  }

  /**
   * Get database bytes from IndexedDB
   */
  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        const v = req.result || null
        db.close()
        resolve(v)
      }
      req.onerror = () => {
        const e = req.error
        db.close()
        reject(e)
      }
    })
  }

  /**
   * Delete database from IndexedDB
   */
  async delete(key: string): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const req = tx.objectStore(IDB_STORE).delete(key)
      req.onsuccess = () => {
        db.close()
        resolve()
      }
      req.onerror = () => {
        const e = req.error
        db.close()
        reject(e)
      }
    })
  }

  /**
   * Clean up old fallback databases from IndexedDB
   */
  async cleanupFallbackDatabases(): Promise<void> {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ifcWorkerDB', 1)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      const tx = db.transaction(['kvStore'], 'readonly')
      const store = tx.objectStore('kvStore')
      const getAllKeysReq = store.getAllKeys()

      await new Promise<void>((resolve, reject) => {
        getAllKeysReq.onsuccess = async () => {
          const keys = getAllKeysReq.result as string[]
          const fallbackKeys = keys.filter((k) => k.includes(':v2'))

          if (fallbackKeys.length > 0) {
            const deleteTx = db.transaction(['kvStore'], 'readwrite')
            const deleteStore = deleteTx.objectStore('kvStore')

            for (const key of fallbackKeys) {
              deleteStore.delete(key)
            }

            deleteTx.oncomplete = () => {
              resolve()
            }
            deleteTx.onerror = () => reject(deleteTx.error)
          } else {
            resolve()
          }
        }
        getAllKeysReq.onerror = () => reject(getAllKeysReq.error)
      })

      db.close()
    } catch (error) {
      // Silently fail - cleanup is best effort
      console.warn('Failed to cleanup fallback databases:', error)
    }
  }

  /**
   * Compute database key from buffer for caching
   */
  computeDbKeyFromBuffer(filename: string, arrayBuffer: ArrayBuffer): string {
    try {
      const u8 = new Uint8Array(arrayBuffer)
      const size = u8.length >>> 0
      const slice = 16 * 1024 * 1024 // 16MB slice
      const first = u8.subarray(0, Math.min(slice, size))
      const last = size > slice ? u8.subarray(size - slice, size) : first
      const c1 = this.crc32(first).toString(16)
      const c2 = this.crc32(last).toString(16)
      return `db:${size}-${c1}-${c2}`
    } catch {
      // Fallback to filename-based key
      return `db:${filename || 'default'}`
    }
  }

  /**
   * Fast CRC32 implementation for Uint8Array
   */
  private crc32(uint8: Uint8Array): number {
    let crc = -1 >>> 0
    for (let i = 0; i < uint8.length; i++) {
      crc = (crc ^ uint8[i]) >>> 0
      for (let j = 0; j < 8; j++) {
        const mask = -(crc & 1)
        crc = (crc >>> 1) ^ (0xedb88320 & mask)
      }
    }
    return (crc ^ (-1 >>> 0)) >>> 0
  }
}


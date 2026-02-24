/**
 * Persist the current project (GeoPackage buffer) in IndexedDB so it survives page refresh.
 * No React. Pure functions.
 */

const DB_NAME = "gabriel-project"
const STORE_NAME = "project"
const KEY = "current"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * Save the current project buffer to IndexedDB. Overwrites any existing stored project.
 */
export function saveProject(
  buffer: ArrayBuffer,
  metadata?: { fileName?: string },
): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const value = {
        buffer,
        fileName: metadata?.fileName,
        savedAt: Date.now(),
      }
      const request = store.put(value, KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
      tx.oncomplete = () => db.close()
    })
  })
}

export interface LoadedProject {
  buffer: ArrayBuffer
  fileName?: string
}

/**
 * Load the current project from IndexedDB, if any. Returns null if none stored or on error.
 */
export function loadProject(): Promise<LoadedProject | null> {
  return openDb()
    .then((db) => {
      return new Promise<LoadedProject | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(KEY)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const row = request.result as { buffer?: ArrayBuffer; fileName?: string } | undefined
          if (row?.buffer instanceof ArrayBuffer) {
            resolve({ buffer: row.buffer, fileName: row.fileName })
          } else {
            resolve(null)
          }
        }
        tx.oncomplete = () => db.close()
      })
    })
    .catch(() => null)
}

/**
 * Clear the stored project from IndexedDB so the next load will not restore it.
 */
export function clearProject(): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
      tx.oncomplete = () => db.close()
    })
  })
}

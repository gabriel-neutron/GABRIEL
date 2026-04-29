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

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openDb().then((db) =>
    new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const close = () => db.close()
      tx.oncomplete = close
      tx.onerror = close
      tx.onabort = close
      run(tx.objectStore(STORE_NAME), resolve, reject)
    }),
  )
}

export function saveProject(buffer: ArrayBuffer): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.put({ buffer, savedAt: Date.now() }, KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export interface LoadedProject {
  buffer: ArrayBuffer
}

/**
 * Load the current project from IndexedDB, if any. Returns null if none is stored.
 * Throws when IndexedDB operations fail.
 */
export function loadProject(): Promise<LoadedProject | null> {
  return withStore<LoadedProject | null>("readonly", (store, resolve, reject) => {
    const request = store.get(KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const row = request.result as { buffer?: ArrayBuffer } | undefined
      resolve(row?.buffer instanceof ArrayBuffer ? { buffer: row.buffer } : null)
    }
  }).catch((reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    throw new Error(`projectStorage: failed to load persisted project (${message})`)
  })
}

/**
 * Clear the stored project from IndexedDB so the next load will not restore it.
 */
export function clearProject(): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

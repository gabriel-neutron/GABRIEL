/**
 * Persist map tiles as Blobs in a dedicated IndexedDB database so revisited areas
 * render instantly (and offline) without re-hitting the throttled tile server.
 * Separate DB from `gabriel-project` (see projectStorage.service) — different
 * lifecycle; a project switch must never touch tiles, and vice versa.
 * No React. Pure functions. Failures reject; the caller (CachedTileLayer) falls
 * back to the network — a tile-cache error must never block the map.
 */
import { TILE_CACHE_CAP, selectEvictionVictims, type TileMeta } from "./tileCache.logic"

const DB_NAME = "gabriel-tiles"
const STORE_NAME = "tiles"
const SAVED_AT_INDEX = "savedAt"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME)
        store.createIndex(SAVED_AT_INDEX, "savedAt")
      }
    }
  })
}

/**
 * Reuse one long-lived connection instead of opening/closing per tile — a viewport is
 * dozens of reads/writes, so the open handshake would otherwise sit on the map's hot path.
 * The promise is reset if the connection drops so the next call reopens.
 */
let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (dbPromise == null) {
    dbPromise = openDb()
      .then((db) => {
        db.onclose = () => {
          dbPromise = null
        }
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        return db
      })
      .catch((error) => {
        dbPromise = null
        throw error
      })
  }
  return dbPromise
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return getDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        run(tx.objectStore(STORE_NAME), resolve, reject)
      }),
  )
}

export function getTile(key: string): Promise<Blob | null> {
  return withStore<Blob | null>("readonly", (store, resolve, reject) => {
    const request = store.get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const row = request.result as { blob?: Blob } | undefined
      resolve(row?.blob instanceof Blob ? row.blob : null)
    }
  })
}

export function putTile(key: string, blob: Blob): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.put({ blob, savedAt: Date.now() }, key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export function countTiles(): Promise<number> {
  return withStore<number>("readonly", (store, resolve, reject) => {
    const request = store.count()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export function clearTiles(): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.clear()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/** Read every tile's key + savedAt via the index cursor, without deserializing the blobs. */
function listTileMeta(): Promise<TileMeta[]> {
  return withStore<TileMeta[]>("readonly", (store, resolve, reject) => {
    const request = store.index(SAVED_AT_INDEX).openKeyCursor()
    const out: TileMeta[] = []
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        out.push({ key: String(cursor.primaryKey), savedAt: Number(cursor.key) })
        cursor.continue()
      } else {
        resolve(out)
      }
    }
  })
}

function deleteTiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve()
  return withStore<void>("readwrite", (store, resolve, reject) => {
    let remaining = keys.length
    for (const key of keys) {
      const request = store.delete(key)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        remaining -= 1
        if (remaining === 0) resolve()
      }
    }
  })
}

/** Drop a single tile — used to evict a poisoned entry that failed to decode. */
export function deleteTile(key: string): Promise<void> {
  return deleteTiles([key])
}

/**
 * Evict oldest tiles when the cache exceeds the cap. Cheap `count()` guard first so the
 * common (under-cap) case never pays for the full metadata cursor scan. Fire-and-forget.
 */
export function pruneTileCache(cap: number = TILE_CACHE_CAP): Promise<void> {
  return countTiles().then((count) => {
    if (count <= cap) return
    return listTileMeta().then((meta) => deleteTiles(selectEvictionVictims(meta, cap)))
  })
}

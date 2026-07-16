/**
 * A drop-in replacement for react-leaflet's `<TileLayer>` that serves tiles from a
 * persistent IndexedDB cache (see tileCache.service) — cache-first, populating on
 * miss. Revisited zones render instantly and offline. Any cache/CORS/network error
 * falls through to a plain network tile load so the map never breaks.
 *
 * Mirrors react-leaflet's own TileLayer (createTileLayerComponent + updateGridLayer)
 * so it stays a declarative, prop-updatable component. Excluded from coverage — its
 * logic lives in the unit-tested tileCache.logic / tileCache.service; this file is the
 * DOM/Leaflet glue, only observable through the Playwright acceptance harness.
 */
import L from "leaflet"
import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from "@react-leaflet/core"
import type { TileLayerProps } from "react-leaflet"
import { tileCacheKey } from "./tileCache.logic"
import { deleteTile, getTile, pruneTileCache, putTile } from "./tileCache.service"

type CacheTileImg = HTMLImageElement & { _cacheObjectUrl?: string | null; _cacheAbort?: AbortController }

/** Only cache actual images — some servers answer 200 with an HTML error / captive-portal page. */
function isImageResponse(response: Response): boolean {
  const type = response.headers.get("content-type")
  return type != null && type.startsWith("image/")
}

/** Prune runs at most once per this many freshly-cached tiles, so a burst of misses during a
 *  pan doesn't fire a metadata scan per tile. */
const PRUNE_EVERY = 64
let putsSincePrune = 0

class CachingTileLayer extends L.TileLayer {
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement("img") as CacheTileImg
    img.setAttribute("role", "presentation")
    img.alt = ""

    const template = (this as unknown as { _url: string })._url
    const url = this.getTileUrl(coords)
    const key = tileCacheKey(template, coords.z, coords.x, coords.y)

    const controller = new AbortController()
    img._cacheAbort = controller
    img._cacheObjectUrl = null

    // Blob fetched from the network on a miss, cached only once the <img> actually decodes it
    // (see the `load` handler) — a non-image / corrupt body never poisons the cache.
    let pendingBlob: Blob | null = null
    let servedFromCache = false
    let retriedFromNetwork = false

    const showBlob = (blob: Blob): void => {
      img._cacheObjectUrl = URL.createObjectURL(blob)
      img.src = img._cacheObjectUrl
    }

    img.addEventListener("load", () => {
      done(undefined, img)
      if (pendingBlob) {
        const blob = pendingBlob
        pendingBlob = null
        void putTile(key, blob)
          .then(() => {
            putsSincePrune += 1
            if (putsSincePrune >= PRUNE_EVERY) {
              putsSincePrune = 0
              return pruneTileCache()
            }
          })
          .catch(() => {
            /* cache write is best-effort; a failure must not affect display */
          })
      }
    })

    img.addEventListener("error", () => {
      // A cached blob that won't decode is poisoned (truncated write, format the browser
      // rejects). Drop it and retry from the network once, so one bad entry can't break this
      // tile forever the way a plain TileLayer's per-request network load wouldn't.
      if (servedFromCache && !retriedFromNetwork) {
        retriedFromNetwork = true
        servedFromCache = false
        if (img._cacheObjectUrl) {
          URL.revokeObjectURL(img._cacheObjectUrl)
          img._cacheObjectUrl = null
        }
        void deleteTile(key).catch(() => {})
        img.src = url
        return
      }
      done(new Error(`tile failed: ${key}`), img)
    })

    const fallbackToNetwork = (reason: unknown): void => {
      if (controller.signal.aborted) return
      console.warn(
        `tileCache: network fallback for ${key} (${reason instanceof Error ? reason.message : String(reason)})`,
      )
      img.src = url
    }

    getTile(key)
      .then((cached) => {
        if (controller.signal.aborted) return
        if (cached) {
          servedFromCache = true
          showBlob(cached)
          return
        }
        return fetch(url, { signal: controller.signal }).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          if (!isImageResponse(response)) {
            done(new Error(`non-image tile: ${key}`), img)
            return
          }
          return response.blob().then((fresh) => {
            if (controller.signal.aborted) return
            pendingBlob = fresh // cached in the `load` handler, once decode succeeds
            showBlob(fresh)
          })
        })
      })
      .catch(fallbackToNetwork)

    return img
  }
}

/**
 * On `tileunload` (pan/zoom discards a tile), abort its in-flight fetch and release its blob
 * URL. Revoking here — rather than on `load` — keeps the URL valid for the tile's whole
 * retained lifetime, so a parent tile Leaflet keeps across a zoom can still repaint, and a
 * tile discarded before it loaded doesn't leak its blob.
 */
function releaseDiscardedTile(event: L.TileEvent): void {
  const tile = event.tile as CacheTileImg
  tile._cacheAbort?.abort()
  if (tile._cacheObjectUrl) {
    URL.revokeObjectURL(tile._cacheObjectUrl)
    tile._cacheObjectUrl = null
  }
}

export const CachedTileLayer = createTileLayerComponent<CachingTileLayer, TileLayerProps>(
  function createCachedTileLayer({ url, ...options }, context) {
    const layer = new CachingTileLayer(url, withPane(options, context))
    layer.on("tileunload", releaseDiscardedTile)
    return createElementObject(layer, context)
  },
  function updateCachedTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps)
    if (props.url != null && props.url !== prevProps.url) {
      layer.setUrl(props.url)
    }
  },
)

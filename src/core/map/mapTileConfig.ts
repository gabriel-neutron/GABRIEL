import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

export type TileLayerConfig = {
  url: string
  attribution: string
  /**
   * Deepest zoom the provider actually serves tiles for. Beyond it Leaflet upscales
   * (stretches) the last real tile instead of requesting a non-existent one — turns
   * "blank/never-loading tile over a rural area" into "slightly soft but instant".
   */
  maxNativeZoom?: number
  overlay?: { url: string; attribution: string; subdomains?: string; maxNativeZoom?: number }
}

/**
 * Shared tile-loading options spread onto every base/overlay layer.
 * - `maxZoom: 19` — allow zooming past a provider's `maxNativeZoom` (Leaflet upscales).
 * Movement options (`keepBuffer`/`updateWhenZooming`/`updateWhenIdle`) are left at Leaflet's
 * defaults on purpose: raising keepBuffer and deferring to idle batched a whole viewport into
 * one simultaneous burst, which the throttled tile server answered ~5x slower than
 * progressive default loading (measured). Tiles load natively (a plain react-leaflet
 * TileLayer) and rely on the browser's HTTP cache, which OSM serves with a multi-hour
 * max-age + 7-day stale-while-revalidate — robust, and no custom fetch/IndexedDB path to
 * strand a tile if a read hangs.
 */
export const BASE_TILE_OPTIONS = {
  maxZoom: 19,
} as const

export const BASE_MAP_TILE_CONFIG: Record<BaseMapId, TileLayerConfig> = {
  osm: {
    // Shard across a/b/c: OSM throttles per host, so 3 hosts answer a viewport burst ~5x
    // faster than one (measured) — the single-host "HTTP/2 is enough" theory loses to the
    // server's per-host rate limiting in practice.
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxNativeZoom: 17,
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxNativeZoom: 17,
    overlay: {
      url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
    },
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxNativeZoom: 17,
  },
}

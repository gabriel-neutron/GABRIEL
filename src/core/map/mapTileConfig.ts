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
 * Shared tile-loading options spread onto every base/overlay layer. Tuned for a
 * fair-use-throttled tile server + users who stay in the same zones:
 * - `keepBuffer: 4` — keep a fat ring of off-screen tiles so a pan reuses them
 *   instead of re-fetching from the slow origin.
 * - `updateWhenZooming: false` + `updateWhenIdle: true` — only fetch the final
 *   viewport once motion settles, never the transient tiles mid-gesture.
 * - `crossOrigin: "anonymous"` — required so the persistent tile cache can read
 *   fetched tiles into a Blob (CORS verified on all providers).
 * Deliberately NOT `detectRetina` — it quadruples requests against the throttled server.
 */
export const BASE_TILE_OPTIONS = {
  keepBuffer: 4,
  updateWhenZooming: false,
  updateWhenIdle: true,
  crossOrigin: "anonymous",
  maxZoom: 19,
} as const

export const BASE_MAP_TILE_CONFIG: Record<BaseMapId, TileLayerConfig> = {
  osm: {
    // Single host — OSM serves over HTTP/2, so the deprecated {s} a/b/c sharding only
    // adds DNS/TLS overhead and defeats connection reuse.
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
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

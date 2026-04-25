export type LatLng = [number, number] & { readonly _brand: "LatLng" }
export type LngLat = [number, number] & { readonly _brand: "LngLat" }

/** GeoJSON [lng, lat] storage pair → internal [lat, lng] */
export function toLeafletCoord(lng: number, lat: number): LatLng {
  return [lat, lng] as unknown as LatLng
}

/** Internal [lat, lng] → GeoJSON [lng, lat] storage pair */
export function toGeoJsonCoord(pos: LatLng): LngLat {
  return [pos[1], pos[0]] as unknown as LngLat
}

/** Construct a LatLng from already-known lat/lng values (no order swap) */
export function asLatLng(lat: number, lng: number): LatLng {
  return [lat, lng] as unknown as LatLng
}

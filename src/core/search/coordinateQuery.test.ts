import { describe, expect, it } from "vitest"
import { parseCoordinateQuery } from "./coordinateQuery"

describe("parseCoordinateQuery", () => {
  it("reads a comma-separated pair as latitude then longitude", () => {
    expect(parseCoordinateQuery("48.5, 37.2")).toEqual({ lat: 48.5, lng: 37.2 })
  })

  it("accepts the separators a coordinate is actually pasted with", () => {
    // Copying a pair out of another tool yields any of these; refusing them would send
    // the analyst to Nominatim for a place they already have the coordinates of.
    expect(parseCoordinateQuery("48.5 37.2")).toEqual({ lat: 48.5, lng: 37.2 })
    expect(parseCoordinateQuery("48.5;37.2")).toEqual({ lat: 48.5, lng: 37.2 })
    expect(parseCoordinateQuery("  -48.5 , -37.2  ")).toEqual({ lat: -48.5, lng: -37.2 })
  })

  it("swaps a pair that can only be lng,lat", () => {
    // A first value above 90 cannot be a latitude, so the pair was written the other way
    // round. Swapping is only safe when the swap itself is in range, which is checked.
    expect(parseCoordinateQuery("120.0, 45.0")).toEqual({ lat: 45, lng: 120 })
  })

  it("refuses a pair no ordering makes valid", () => {
    expect(parseCoordinateQuery("200, 300")).toBeNull()
    expect(parseCoordinateQuery("95, 91")).toBeNull()
  })

  it("refuses anything that is not a bare pair of numbers", () => {
    // A name is not a coordinate: were this to match, pressing Enter on it would fly the
    // map somewhere instead of searching for the place.
    expect(parseCoordinateQuery("Wagner")).toBeNull()
    expect(parseCoordinateQuery("")).toBeNull()
    expect(parseCoordinateQuery("48.5")).toBeNull()
    expect(parseCoordinateQuery("48.5, 37.2, 12")).toBeNull()
  })
})

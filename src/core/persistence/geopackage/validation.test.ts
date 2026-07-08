import { describe, expect, it } from "vitest"
import { decodeLayerKind, decodeOrganisationType, decodePositionMode } from "./validation"

describe("decodePositionMode", () => {
  it("passes through valid values", () => {
    expect(decodePositionMode("own")).toBe("own")
    expect(decodePositionMode("parent")).toBe("parent")
    expect(decodePositionMode("none")).toBe("none")
  })

  it("defaults invalid or legacy values to 'own'", () => {
    expect(decodePositionMode("bogus")).toBe("own")
    expect(decodePositionMode(null)).toBe("own")
    expect(decodePositionMode(undefined)).toBe("own")
    expect(decodePositionMode(42)).toBe("own")
  })
})

describe("decodeOrganisationType", () => {
  it("passes through valid values", () => {
    expect(decodeOrganisationType("holding")).toBe("holding")
    expect(decodeOrganisationType("factory")).toBe("factory")
  })

  it("defaults invalid or legacy values to 'other'", () => {
    expect(decodeOrganisationType("bogus")).toBe("other")
    expect(decodeOrganisationType(null)).toBe("other")
    expect(decodeOrganisationType(undefined)).toBe("other")
  })
})

describe("decodeLayerKind", () => {
  it("passes through valid values", () => {
    expect(decodeLayerKind("echelon")).toBe("echelon")
    expect(decodeLayerKind("custom")).toBe("custom")
    expect(decodeLayerKind("osm")).toBe("osm")
    expect(decodeLayerKind("organisation")).toBe("organisation")
  })

  it("returns undefined for invalid or missing values", () => {
    expect(decodeLayerKind("bogus")).toBeUndefined()
    expect(decodeLayerKind(null)).toBeUndefined()
    expect(decodeLayerKind(undefined)).toBeUndefined()
  })
})

import { describe, expect, it } from "vitest"
import {
  decodeAliases,
  decodeExternalIds,
  decodeLayerKind,
  decodeOrganisationType,
  decodePositionMode,
} from "./validation"

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

describe("decodeAliases", () => {
  it("parses a JSON array of non-empty strings", () => {
    expect(decodeAliases('["Вагнер","PMC Wagner"]')).toEqual(["Вагнер", "PMC Wagner"])
  })

  it("returns undefined for missing, empty, non-array, or corrupt values", () => {
    expect(decodeAliases(null)).toBeUndefined()
    expect(decodeAliases("")).toBeUndefined()
    expect(decodeAliases("[]")).toBeUndefined()
    expect(decodeAliases('"a string"')).toBeUndefined()
    expect(decodeAliases("not json")).toBeUndefined()
    expect(decodeAliases(42)).toBeUndefined()
  })

  it("filters out non-string and blank entries", () => {
    expect(decodeAliases('["ok", 1, "", "  ", "also ok"]')).toEqual(["ok", "also ok"])
  })
})

describe("decodeExternalIds", () => {
  it("parses a JSON array of well-formed external ids", () => {
    expect(
      decodeExternalIds('[{"scheme":"imo","value":"9074729"},{"scheme":"lei","value":"5493001KJTIIGC8Y1R12"}]'),
    ).toEqual([
      { scheme: "imo", value: "9074729" },
      { scheme: "lei", value: "5493001KJTIIGC8Y1R12" },
    ])
  })

  it("returns undefined for missing, empty, non-array, or corrupt values", () => {
    // "[]" decoding to undefined rather than [] is Trap T5: an empty array would make
    // every row in a loaded project report as carrying external ids.
    expect(decodeExternalIds(undefined)).toBeUndefined()
    expect(decodeExternalIds(null)).toBeUndefined()
    expect(decodeExternalIds("")).toBeUndefined()
    expect(decodeExternalIds("not json")).toBeUndefined()
    expect(decodeExternalIds("{}")).toBeUndefined()
    expect(decodeExternalIds('{"scheme":"imo"}')).toBeUndefined()
    expect(decodeExternalIds("[]")).toBeUndefined()
    expect(decodeExternalIds(42)).toBeUndefined()
    expect(decodeExternalIds([])).toBeUndefined()
  })

  it("drops entries with an unknown scheme, a missing field, or a blank value", () => {
    const decoded = decodeExternalIds(
      '[{"scheme":"imo","value":"9074729"},{"scheme":"bogus","value":"x"},{"scheme":"lei"},{"scheme":"inn","value":"  "},7]',
    )
    expect(decoded).toEqual([{ scheme: "imo", value: "9074729" }])
    expect(decoded).toHaveLength(1)

    // An array whose members are all dropped is absent, not empty (Trap T5).
    expect(decodeExternalIds('[{"scheme":"bogus","value":"x"},{"scheme":"inn","value":""},null]')).toBeUndefined()
  })

  it("keeps a structurally invalid but well-shaped id", () => {
    // 9074728 fails the IMO check digit. That is a validation concern, not a decoding
    // one — dropping it here would silently delete what the analyst typed on next save.
    expect(decodeExternalIds('[{"scheme":"imo","value":"9074728"}]')).toEqual([
      { scheme: "imo", value: "9074728" },
    ])
  })

  it("never throws on arbitrary input", () => {
    const inputs: unknown[] = [
      undefined,
      null,
      0,
      NaN,
      true,
      {},
      { scheme: "imo", value: "9074729" },
      [{ scheme: "imo", value: "9074729" }],
      new Date("2026-07-29T00:00:00.000Z"),
      '[[[[[[{"scheme":"imo","value":"9074729"}]]]]]]',
      "null",
      "x".repeat(100000),
    ]
    for (const raw of inputs) {
      expect(() => decodeExternalIds(raw)).not.toThrow()
      const decoded = decodeExternalIds(raw)
      expect(decoded === undefined || Array.isArray(decoded)).toBe(true)
    }
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

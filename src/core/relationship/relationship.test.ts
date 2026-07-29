import { describe, expect, it } from "vitest"
import { decodeExportOverride, type ExportOverride } from "./relationship"

const WELL_FORMED: ExportOverride = {
  proposedBy: "analyst-a",
  confirmedBy: "analyst-b",
  confirmedAt: "2026-07-29",
  rationale: "Blocking-minority shareholding is stated in the source and must ship with the edge.",
}

const REQUIRED_FIELDS = ["proposedBy", "confirmedBy", "confirmedAt", "rationale"] as const

describe("decodeExportOverride", () => {
  it("decodes a well-formed export override from an object and from the equivalent JSON string", () => {
    expect(decodeExportOverride(WELL_FORMED)).toEqual(WELL_FORMED)
    expect(decodeExportOverride(JSON.stringify(WELL_FORMED))).toEqual(WELL_FORMED)
  })

  it("returns undefined for a non-object", () => {
    const nonObjects: unknown[] = [
      undefined,
      null,
      0,
      42,
      true,
      false,
      "not json at all",
      "42",
      "null",
      [],
      [WELL_FORMED],
      JSON.stringify([WELL_FORMED]),
      () => WELL_FORMED,
      Symbol("override"),
    ]
    for (const input of nonObjects) {
      expect(decodeExportOverride(input)).toBeUndefined()
    }
  })

  it("returns undefined when a field is missing", () => {
    for (const field of REQUIRED_FIELDS) {
      const partial: Record<string, unknown> = { ...WELL_FORMED }
      delete partial[field]
      expect(decodeExportOverride(partial)).toBeUndefined()
      expect(decodeExportOverride(JSON.stringify(partial))).toBeUndefined()
    }
  })

  it("returns undefined when a field is an empty string", () => {
    for (const field of REQUIRED_FIELDS) {
      const emptied: Record<string, unknown> = { ...WELL_FORMED, [field]: "" }
      expect(decodeExportOverride(emptied)).toBeUndefined()
      expect(decodeExportOverride(JSON.stringify(emptied))).toBeUndefined()
    }
  })

  it("returns undefined when proposedBy equals confirmedBy", () => {
    const selfConfirmed = { ...WELL_FORMED, confirmedBy: WELL_FORMED.proposedBy }
    expect(decodeExportOverride(selfConfirmed)).toBeUndefined()
    expect(decodeExportOverride(JSON.stringify(selfConfirmed))).toBeUndefined()
  })

  it("returns undefined for a malformed confirmedAt", () => {
    const malformed = ["2026-7-29", "29-07-2026", "20260729", "2026-07", "yesterday", "0000"]
    for (const confirmedAt of malformed) {
      expect(decodeExportOverride({ ...WELL_FORMED, confirmedAt })).toBeUndefined()
    }
    // The spec's pattern is /^\d{4}-\d{2}-\d{2}/ — unanchored at the end, so a
    // full ISO timestamp is a valid confirmedAt.
    expect(decodeExportOverride({ ...WELL_FORMED, confirmedAt: "2026-07-29T10:00:00.000Z" })).toEqual({
      ...WELL_FORMED,
      confirmedAt: "2026-07-29T10:00:00.000Z",
    })
  })

  it("never throws on arbitrary input", () => {
    const hostileGetter = {
      get proposedBy(): string {
        throw new Error("exploding getter")
      },
      confirmedBy: "analyst-b",
      confirmedAt: "2026-07-29",
      rationale: "whatever",
    }
    const circular: Record<string, unknown> = { proposedBy: "analyst-a" }
    circular.self = circular

    const hostile: unknown[] = [
      hostileGetter,
      circular,
      new Date(),
      new Map([["proposedBy", "analyst-a"]]),
      new Set(["analyst-a"]),
      { proposedBy: 1, confirmedBy: 2, confirmedAt: 3, rationale: 4 },
      { proposedBy: null, confirmedBy: null, confirmedAt: null, rationale: null },
      "{ this is not json",
      "{}",
      Object.create(null) as unknown,
      Number.NaN,
    ]
    for (const input of hostile) {
      expect(() => decodeExportOverride(input)).not.toThrow()
    }
  })
})

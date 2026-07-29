import { describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import type { Entity } from "./entity"
import {
  EXTERNAL_ID_LABELS,
  externalIdKey,
  isValidExternalId,
  normalizeExternalId,
  type ExternalId,
  type ExternalIdScheme,
} from "./externalId"

/**
 * Transcribed from the build spec (GABRIEL_V2_SLICE_0_1_BUILD.md:379-381 for the
 * union, :407-408 for the labels), deliberately not read off the implementation:
 * this record is the contract the implementation is graded against, so copying it
 * from the source under test would assert nothing.
 */
const SPEC_LABELS: Record<ExternalIdScheme, string> = {
  imo: "IMO number",
  inn: "INN",
  ogrn: "OGRN",
  lei: "LEI",
  ofac: "OFAC SDN id",
  eu_fsf: "EU FSF id",
  uk_hmt: "UK HMT id",
  opensanctions: "OpenSanctions id",
  registry: "Registry id",
}

/**
 * Iterated from the shipped record rather than from SPEC_LABELS so that a tenth
 * scheme cannot be added without the every-scheme tests below covering it. The
 * length guard keeps those loops from passing vacuously if the record is emptied.
 */
const ALL_SCHEMES = Object.keys(EXTERNAL_ID_LABELS) as ExternalIdScheme[]

const FREE_FORM_SCHEMES: ExternalIdScheme[] = ["ofac", "eu_fsf", "uk_hmt", "opensanctions", "registry"]

function imo(value: string): ExternalId {
  return { scheme: "imo", value }
}

describe("EXTERNAL_ID_LABELS", () => {
  it("labels every scheme with the authored UI string", () => {
    expect(EXTERNAL_ID_LABELS).toEqual(SPEC_LABELS)
    expect(Object.keys(EXTERNAL_ID_LABELS)).toHaveLength(9)
  })
})

describe("isValidExternalId - IMO check digit", () => {
  it("accepts the worked IMO example 9074729", () => {
    // Digits one to six weighted 7,6,5,4,3,2:
    // 9*7 + 0*6 + 7*5 + 4*4 + 7*3 + 2*2 = 63 + 0 + 35 + 16 + 21 + 4 = 139; 139 % 10 = 9,
    // which is digit seven. (The spec prints the first term as 7*7; that is a typo.)
    expect(isValidExternalId(imo("9074729"))).toBe(true)
    expect(isValidExternalId(imo("IMO 9074729"))).toBe(true)
  })

  it("rejects a transposition of a valid IMO number", () => {
    // 9704729 swaps digits two and three: 9*7 + 7*6 + 0*5 + 4*4 + 7*3 + 2*2 = 146,
    // 146 % 10 = 6, which is not digit seven (9).
    expect(isValidExternalId(imo("9704729"))).toBe(false)
  })

  it("accepts a second IMO derived from the algorithm", () => {
    // 1*7 + 2*6 + 3*5 + 4*4 + 5*3 + 6*2 = 7 + 12 + 15 + 16 + 15 + 12 = 77; 77 % 10 = 7.
    expect(isValidExternalId(imo("1234567"))).toBe(true)
  })

  it("rejects an IMO with a wrong check digit, wrong length, or a non-digit character", () => {
    expect(isValidExternalId(imo("9074728"))).toBe(false)
    expect(isValidExternalId(imo("907472"))).toBe(false)
    expect(isValidExternalId(imo("90747290"))).toBe(false)
    expect(isValidExternalId(imo("907472A"))).toBe(false)
  })
})

describe("isValidExternalId - LEI", () => {
  it("accepts a 20-character alphanumeric LEI in either case", () => {
    expect(isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R12" })).toBe(true)
    expect(isValidExternalId({ scheme: "lei", value: "5493001kjtiigc8y1r12" })).toBe(true)
  })

  it("rejects a LEI of the wrong length or charset", () => {
    expect(isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R1" })).toBe(false)
    expect(isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R123" })).toBe(false)
    expect(isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R1*" })).toBe(false)
  })

  it("records the known gap: a mod-97-invalid LEI still passes structural validation", () => {
    // Deliberate, recorded gap (spec:404): Slice 1 ships no mod-97 check, so a typo'd
    // LEI of the right shape is accepted. This is intended behaviour, not a defect —
    // the slice that adds mod-97 has to change this test on purpose.
    expect(isValidExternalId({ scheme: "lei", value: "5493001KJTIIGC8Y1R00" })).toBe(true)
  })
})

describe("isValidExternalId - INN, OGRN and the free-form schemes", () => {
  it("accepts an INN of 10 or 12 digits and rejects 11", () => {
    expect(isValidExternalId({ scheme: "inn", value: "7707083893" })).toBe(true)
    expect(isValidExternalId({ scheme: "inn", value: "500100732259" })).toBe(true)
    expect(isValidExternalId({ scheme: "inn", value: "77070838931" })).toBe(false)
    expect(isValidExternalId({ scheme: "inn", value: "770708389" })).toBe(false)
    expect(isValidExternalId({ scheme: "inn", value: "770708389A" })).toBe(false)
  })

  it("accepts an OGRN of 13 or 15 digits and rejects 14", () => {
    expect(isValidExternalId({ scheme: "ogrn", value: "1027700132195" })).toBe(true)
    expect(isValidExternalId({ scheme: "ogrn", value: "304500116000157" })).toBe(true)
    expect(isValidExternalId({ scheme: "ogrn", value: "10277001321950" })).toBe(false)
    expect(isValidExternalId({ scheme: "ogrn", value: "102770013219" })).toBe(false)
    expect(isValidExternalId({ scheme: "ogrn", value: "102770013219A" })).toBe(false)
  })

  it("accepts any non-empty value for the five registry and sanctions schemes", () => {
    const samples: Record<string, string> = {
      ofac: "12345",
      eu_fsf: "EU.1234.56",
      uk_hmt: "CHE0001",
      opensanctions: "NK-A7bC",
      registry: "1027700132195",
    }
    expect(FREE_FORM_SCHEMES).toHaveLength(5)
    for (const scheme of FREE_FORM_SCHEMES) {
      expect(isValidExternalId({ scheme, value: samples[scheme] })).toBe(true)
    }
  })

  it("rejects an empty or whitespace-only value for every scheme", () => {
    expect(ALL_SCHEMES).toHaveLength(9)
    for (const scheme of ALL_SCHEMES) {
      expect(isValidExternalId({ scheme, value: "" })).toBe(false)
      expect(isValidExternalId({ scheme, value: "   " })).toBe(false)
    }
  })
})

describe("normalizeExternalId", () => {
  it("normalizes IMO 9074729 and 9074729 to the same string", () => {
    expect(normalizeExternalId("imo", "IMO 9074729")).toBe(normalizeExternalId("imo", "9074729"))
    expect(normalizeExternalId("imo", "IMO 9074729")).toBe("9074729")
    expect(normalizeExternalId("imo", "9074729")).toBe("9074729")
  })

  it("upper-cases and trims for every scheme, and is idempotent", () => {
    const sample = "  aB-12 cD.34  "
    expect(ALL_SCHEMES).toHaveLength(9)
    for (const scheme of ALL_SCHEMES) {
      const once = normalizeExternalId(scheme, sample)
      expect(once).toBe(once.toUpperCase())
      expect(once).toBe(once.trim())
      expect(normalizeExternalId(scheme, once)).toBe(once)
    }
  })

  it("never throws for any scheme on any input", () => {
    const inputs = ["", "   ", "x".repeat(1000), "  ---...  ", "\u{1F600}\u{1F680}\u{1D11E}"]
    expect(ALL_SCHEMES).toHaveLength(9)
    for (const scheme of ALL_SCHEMES) {
      for (const value of inputs) {
        expect(() => normalizeExternalId(scheme, value)).not.toThrow()
        expect(() => isValidExternalId({ scheme, value })).not.toThrow()
        expect(() => externalIdKey({ scheme, value })).not.toThrow()
      }
    }
  })
})

describe("externalIdKey", () => {
  it("builds a stable dedup key of scheme and normalized value", () => {
    expect(externalIdKey(imo("IMO 9074729"))).toBe("imo:9074729")
    expect(externalIdKey(imo("IMO 9074729"))).toBe(externalIdKey(imo("9074729")))

    // Two ids differing only in formatting collapse onto one key...
    expect(externalIdKey({ scheme: "lei", value: "5493001kjtiigc8y1r12" })).toBe(
      externalIdKey({ scheme: "lei", value: "5493001KJTIIGC8Y1R12" }),
    )

    // ...while the same digits under two schemes stay distinct.
    expect(externalIdKey({ scheme: "inn", value: "1027700132195" })).not.toBe(
      externalIdKey({ scheme: "registry", value: "1027700132195" }),
    )
    expect(externalIdKey({ scheme: "registry", value: "1027700132195" })).toBe("registry:1027700132195")
  })
})

describe("EntityCore.externalIds", () => {
  it("reads externalIds off an Entity without narrowing on kind", () => {
    // The field is declared on EntityCore and reaches Entity through the intersection
    // (spec:411-413) — no hand-written mirror entry, and no narrowing on `kind` needed.
    const e: Entity = {
      kind: "unit",
      id: "e-1",
      name: "Test Unit",
      layerId: "layer-1",
      parentId: null,
      externalIds: [{ scheme: "imo", value: "9074729" }],
    }
    expect(e.externalIds).toHaveLength(1)
    expect(e.externalIds?.[0].scheme).toBe("imo")

    const legacyAlias: MapEntity = e
    expect(legacyAlias.externalIds).toEqual([{ scheme: "imo", value: "9074729" }])
  })
})

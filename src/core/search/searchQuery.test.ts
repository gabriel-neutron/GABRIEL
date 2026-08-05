import { describe, expect, it } from "vitest"
import { buildSearchIndex, type SearchableEntity } from "./searchIndex"
import { explainHit, groupHitsByKind, searchEntities } from "./searchQuery"

function index(entities: SearchableEntity[], claims: Parameters<typeof buildSearchIndex>[0]["claims"] = [], sources: Parameters<typeof buildSearchIndex>[0]["sources"] = []) {
  return buildSearchIndex({ entities, claims, sources })
}

function unit(id: string, name: string, over: Partial<SearchableEntity> = {}): SearchableEntity {
  return { id, name, kind: "unit", ...over }
}

function idsFor(entities: SearchableEntity[], query: string, limit?: number): string[] {
  return searchEntities(index(entities), query, limit == null ? {} : { limit }).map((h) => h.entityId)
}

describe("searchEntities", () => {
  it("finds nothing for a query with no matchable content", () => {
    expect(searchEntities(index([unit("a", "Wagner")]), "   ")).toEqual([])
    expect(searchEntities(index([unit("a", "Wagner")]), "!!!")).toEqual([])
  })

  it("ranks an exact name above a prefix above a word prefix above a substring", () => {
    // This is the defect the old search had: it filtered by substring and took the first
    // six in array order, so an entity named exactly what was typed lost to one that
    // merely contained it earlier in the list.
    const hits = idsFor([
      unit("substring", "Reinforced Fleetwood Yard"),
      unit("word", "Northern Fleet Support"),
      unit("prefix", "Fleet Logistics Centre"),
      unit("exact", "Fleet"),
    ], "fleet")
    expect(hits).toEqual(["exact", "prefix", "word", "substring"])
  })

  it("ranks a name above notes at the same strength", () => {
    const hits = idsFor([
      unit("noted", "Something Else", { notes: "Ostozhenka is the registered address" }),
      unit("named", "Ostozhenka Holdings"),
    ], "ostozhenka")
    expect(hits[0]).toBe("named")
  })

  it("keeps a better result the old six-result cut would have thrown away", () => {
    // The old code sliced before it ranked. The exact match sits last in array order here,
    // so any implementation that truncates first loses it — which is the whole complaint.
    const crowd = Array.from({ length: 10 }, (_, i) => unit(`filler${i}`, `Fleet Depot ${i}`))
    const hits = idsFor([...crowd, unit("exact", "Fleet")], "fleet", 1)
    expect(hits).toEqual(["exact"])
  })

  it("returns one hit per entity, explained by its strongest matching field", () => {
    // Two rows for one entity is two chances to pick the same thing, and the weaker row
    // would explain the match by the weaker reason.
    const hits = searchEntities(
      index([unit("a", "Fleet", { aliases: ["Fleet Logistics"], notes: "fleet depot" })]),
      "fleet",
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].field).toBe("name")
  })

  it("prefers an exact match on a weaker field to a partial one on a stronger field", () => {
    // Strength outranks field on purpose. An identifier or alias reproduced verbatim is a
    // stronger claim to be what was hunted than a name that merely begins with the query,
    // and pinning it here is what stops the two weightings being silently reordered.
    const hits = searchEntities(index([unit("a", "Fleet Command", { aliases: ["Fleet"] })]), "fleet")
    expect(hits[0].field).toBe("alias")
  })

  it("finds an entity by an alias its name does not contain", () => {
    const hits = searchEntities(index([unit("a", "Concord Management", { aliases: ["Wagner"] })]), "wagner")
    expect(hits.map((h) => [h.entityId, h.field])).toEqual([["a", "alias"]])
  })

  it("finds a Cyrillic alias from a Latin query, and back", () => {
    // Story 32: a vessel or company whose name is only known transliterated. The fold is
    // `core/identity`'s, reused rather than restated, so search and duplicate detection
    // can never disagree about whether two spellings are the same name.
    const entities = [unit("a", "Concord Management", { aliases: ["ЧВК Вагнер"] })]
    expect(idsFor(entities, "vagner")).toEqual(["a"])
    expect(idsFor(entities, "Вагнер")).toEqual(["a"])
  })

  it("ignores case and diacritics", () => {
    expect(idsFor([unit("a", "Sévastopol Naval Base")], "SEVASTOPOL")).toEqual(["a"])
  })

  it("finds a vessel by IMO number when its name is unknown", () => {
    // Story 32 proper: the identifier is the only thing an external register agrees on.
    const entities = [unit("v", "Unknown Hull 4", { kind: "vessel", externalIds: [{ scheme: "imo", value: "9074729" }] })]
    expect(idsFor(entities, "9074729")).toEqual(["v"])
    expect(idsFor(entities, "IMO 9074729")).toEqual(["v"])
  })

  it("finds a company by INN", () => {
    const entities = [unit("c", "ООО Пример", { kind: "corporate", externalIds: [{ scheme: "inn", value: "7736050003" }] })]
    expect(searchEntities(index(entities), "7736050003")[0].field).toBe("external-id")
  })

  it("finds an entity by a Claim value", () => {
    const built = index(
      [unit("a", "Concord Management")],
      [{ entityId: "a", field: "address", value: "12 Ostozhenka", sourceId: "s1" }],
    )
    const hits = searchEntities(built, "ostozhenka")
    expect(hits.map((h) => [h.entityId, h.field, h.label])).toEqual([["a", "claim", "address"]])
  })

  it("finds an entity by a Provenance Ledger URL", () => {
    const built = index(
      [unit("a", "Concord Management")],
      [{ entityId: "a", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "https://rusprofile.ru/id/12345" }],
    )
    expect(searchEntities(built, "rusprofile")[0].field).toBe("source")
  })

  it("orders equally scored hits by name, so the list does not shuffle between keystrokes", () => {
    const hits = idsFor([unit("b", "Fleet Bravo"), unit("a", "Fleet Alpha")], "fleet ")
    expect(hits).toEqual(["a", "b"])
  })

  it("applies the limit after ranking, never before", () => {
    const hits = idsFor([unit("a", "Fleet Alpha"), unit("b", "Fleet Bravo"), unit("c", "Fleet")], "fleet", 2)
    expect(hits).toEqual(["c", "a"])
  })
})

describe("explainHit", () => {
  it("says which field matched, and with what text", () => {
    // A result an analyst cannot explain is a result they cannot trust: "matched alias"
    // and "matched a URL in the Ledger" justify very different amounts of confidence.
    const built = index(
      [unit("a", "Concord Management", { aliases: ["Wagner"], externalIds: [{ scheme: "imo", value: "9074729" }] })],
      [{ entityId: "a", field: "address", value: "12 Ostozhenka", sourceId: "s1" }],
    )
    const explain = (query: string) => explainHit(searchEntities(built, query)[0])
    expect(explain("wagner")).toBe("Alias: Wagner")
    expect(explain("9074729")).toBe("IMO number: 9074729")
    expect(explain("ostozhenka")).toBe("Claim address: 12 Ostozhenka")
    expect(explain("concord")).toBe("Name")
  })

  it("truncates a long note rather than pasting a paragraph into a dropdown row", () => {
    const notes = "Ostozhenka ".repeat(40)
    const hit = searchEntities(index([unit("a", "X", { notes })]), "ostozhenka")[0]
    expect(explainHit(hit).length).toBeLessThan(120)
    expect(explainHit(hit).endsWith("…")).toBe(true)
  })
})

describe("groupHitsByKind", () => {
  it("groups by entity kind and labels each group", () => {
    const hits = searchEntities(
      index([
        unit("v", "Fleet Tanker", { kind: "vessel" }),
        unit("u", "Fleet", { kind: "unit" }),
        unit("v2", "Fleet Tender", { kind: "vessel" }),
      ]),
      "fleet",
    )
    const groups = groupHitsByKind(hits)
    expect(groups.map((g) => [g.kind, g.label, g.hits.length])).toEqual([
      ["unit", "Military unit", 1],
      ["vessel", "Vessel", 2],
    ])
  })

  it("orders groups by their best hit, so the strongest match is never below a fold", () => {
    const hits = searchEntities(
      index([unit("v", "Fleet", { kind: "vessel" }), unit("u", "Fleet Depot", { kind: "unit" })]),
      "fleet",
    )
    expect(groupHitsByKind(hits).map((g) => g.kind)).toEqual(["vessel", "unit"])
  })

  it("emits no group for a kind nothing matched", () => {
    expect(groupHitsByKind([])).toEqual([])
  })
})

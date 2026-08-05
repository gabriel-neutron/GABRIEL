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
      unit("substring", "Baltfleet Yard"),
      unit("word", "Northern Fleet Support"),
      unit("prefix", "Fleet Logistics Centre"),
      unit("exact", "Fleet"),
    ], "fleet")
    expect(hits).toEqual(["exact", "prefix", "word", "substring"])
  })

  it("ranks a word prefix above a bare substring, not merely alphabetically", () => {
    // The previous fixture for this tier used "Fleetwood", which the phonetic fold turns
    // into "fleetvood" — still a word prefix — so the ordering above was coming from the
    // name tie-break and the substring tier was never exercised at all.
    const hits = searchEntities(
      index([unit("z-word", "Northern Fleet Support"), unit("a-substring", "Baltfleet Yard")]),
      "fleet",
    )
    expect(hits.map((h) => [h.entityId, h.strength])).toEqual([
      ["z-word", "word-prefix"],
      ["a-substring", "substring"],
    ])
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

  it("finds an identifier pasted with the separators its register prints", () => {
    // `externalId.ts` documents these as being written "1027-7001-32195", and that is the
    // form an analyst pastes. Routing the query through the name fold turned the separators
    // into spaces while the index had removed them, so the correct paste found nothing.
    const entities = [unit("c", "Concord Management", { kind: "corporate", externalIds: [{ scheme: "ogrn", value: "1027700132195" }] })]
    expect(idsFor(entities, "1027-7001-32195")).toEqual(["c"])
    expect(idsFor(entities, "9074-729")).toEqual([])
    expect(idsFor([unit("v", "Hull", { externalIds: [{ scheme: "imo", value: "9074729" }] })], "9074-729")).toEqual(["v"])
  })

  it("does not fold identifier characters phonetically", () => {
    // Two structurally valid LEIs differing only in W vs V. The name fold collapses them,
    // so an exact paste of one returned both, both scored identically and both labelled an
    // exact external-id match — a register's characters are literal, not phonetic.
    const entities = [
      unit("w", "Alpha Holdings", { kind: "corporate", externalIds: [{ scheme: "lei", value: "529900W3MOO00A18X956" }] }),
      unit("v", "Beta Holdings", { kind: "corporate", externalIds: [{ scheme: "lei", value: "529900V3MOO00A18X956" }] }),
    ]
    expect(idsFor(entities, "529900W3MOO00A18X956")).toEqual(["w"])
    expect(idsFor(entities, "529900V3MOO00A18X956")).toEqual(["v"])
  })

  it("finds an upper-case identifier from a lower-case query", () => {
    // Deliberately weaker than the dedup rule in `externalId.ts`: matching is case-blind so
    // an analyst need not reproduce a register's capitalisation.
    const entities = [unit("c", "Alpha", { kind: "corporate", externalIds: [{ scheme: "lei", value: "529900W3MOO00A18X956" }] })]
    expect(idsFor(entities, "529900w3moo00a18x956")).toEqual(["c"])
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

  it("never lets a Source URL outrank an entity actually named the query", () => {
    // A URL is one long term, so "ru" used to word-prefix it and beat an entity whose own
    // name contains the query. A Source says the entity is near the evidence, never that
    // it is the answer, so it may not outscore any match on the entity itself.
    const built = index(
      [unit("named", "Brusilov Battalion"), unit("sourced", "Something Else")],
      [{ entityId: "sourced", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "https://rusprofile.ru/id/12345" }],
    )
    expect(searchEntities(built, "ru").map((h) => h.entityId)).toEqual(["named", "sourced"])
  })

  it("does not match every sourced entity on the boilerplate of a URL", () => {
    const built = index(
      [unit("a", "Concord Management")],
      [{ entityId: "a", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "https://www.rusprofile.ru/id/12345" }],
    )
    expect(searchEntities(built, "https")).toEqual([])
    expect(searchEntities(built, "www")).toEqual([])
  })

  it("does not match a schemeless stored URL on its www", () => {
    // The strip used to require "://", so a URL recorded without a scheme kept "www" as a
    // term prefix and the query "www" returned every entity carrying one.
    const built = index(
      [unit("a", "Concord Management")],
      [{ entityId: "a", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "www.example.com/x" }],
    )
    expect(searchEntities(built, "www")).toEqual([])
    expect(searchEntities(built, "example.com/x").map((h) => h.entityId)).toEqual(["a"])
  })

  it("finds a Source from the whole URL, the form an analyst actually pastes", () => {
    // The index strips scheme and "www." from a Source term. Stripping on one side only is
    // the same index/query asymmetry that made a correctly pasted identifier miss: copying
    // the URL out of the Ledger or the address bar is the most natural way to search for it,
    // and it folded to "https vvv rusprofile ru id 12345" against a term without either.
    const built = index(
      [unit("a", "Concord Management")],
      [{ entityId: "a", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "https://www.rusprofile.ru/id/12345" }],
    )
    const ids = (query: string) => searchEntities(built, query).map((h) => h.entityId)
    expect(ids("https://www.rusprofile.ru/id/12345")).toEqual(["a"])
    expect(ids("www.rusprofile.ru/id/12345")).toEqual(["a"])
    expect(ids("rusprofile.ru/id/12345")).toEqual(["a"])
  })

  it("reports a Source match's true strength while still ranking it below the entity", () => {
    // The ceiling exists to keep a URL from outranking the entity itself; it is a scoring
    // rule, so it may not rewrite what the hit says it was.
    const built = index(
      [unit("named", "Brusilov Battalion"), unit("sourced", "Something Else")],
      [{ entityId: "sourced", field: "sources", value: null, sourceId: "s1" }],
      [{ id: "s1", url: "https://rusprofile.ru/id/12345" }],
    )
    const exact = searchEntities(built, "rusprofile.ru/id/12345")[0]
    expect(exact.strength).toBe("exact")
    expect(exact.score).toBe(110)
    expect(searchEntities(built, "ru").map((h) => h.entityId)).toEqual(["named", "sourced"])
  })

  it("searches a query the text fold empties but the identifier fold keeps", () => {
    // Free-form schemes preserve arbitrary characters by design, so a registry id can be
    // written entirely outside [a-z0-9]. The empty-text gate made every such id unsearchable.
    const entities = [
      unit("c", "Kabushiki Holdings", {
        kind: "corporate",
        externalIds: [{ scheme: "registry", value: "株式会社12345" }],
      }),
    ]
    expect(idsFor(entities, "株式会社12345")).toEqual(["c"])
    expect(idsFor(entities, "株式会社")).toEqual(["c"])
  })

  it("does not let a query the text fold empties match every prose field", () => {
    // The other half of relaxing the gate: an empty query form is a prefix of every term,
    // so a field whose fold the query has no form for must match nothing, not everything.
    const entities = [unit("a", "Wagner Group", { notes: "a note", aliases: ["PMC Wagner"] })]
    expect(idsFor(entities, "株式会社")).toEqual([])
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

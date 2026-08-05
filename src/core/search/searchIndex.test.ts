import { describe, expect, it } from "vitest"
import { buildSearchIndex, type SearchableEntity } from "./searchIndex"

function entity(over: Partial<SearchableEntity> = {}): SearchableEntity {
  return { id: "e1", name: "Wagner Group", kind: "corporate", ...over }
}

function fieldsOf(index: ReturnType<typeof buildSearchIndex>, field: string) {
  return index.fields.filter((f) => f.field === field)
}

describe("buildSearchIndex", () => {
  it("indexes an entity's name", () => {
    const index = buildSearchIndex({ entities: [entity()] })
    expect(fieldsOf(index, "name")).toHaveLength(1)
    expect(fieldsOf(index, "name")[0]).toMatchObject({ entityId: "e1", text: "Wagner Group" })
  })

  it("indexes every alias as its own field, not as part of the name", () => {
    // An alias is the reason a merged record is still findable under its losing spelling.
    // Folding it into the name field would make the hit unable to say which spelling matched.
    const index = buildSearchIndex({ entities: [entity({ aliases: ["ЧВК Вагнер", "PMC Wagner"] })] })
    expect(fieldsOf(index, "alias").map((f) => f.text)).toEqual(["ЧВК Вагнер", "PMC Wagner"])
  })

  it("indexes an external id under its scheme's label", () => {
    const index = buildSearchIndex({
      entities: [entity({ externalIds: [{ scheme: "imo", value: "IMO 9074729" }] })],
    })
    const hit = fieldsOf(index, "external-id")[0]
    expect(hit.text).toBe("IMO 9074729")
    expect(hit.label).toBe("IMO number")
  })

  it("matches an external id with or without its scheme prefix", () => {
    // "IMO 9074729" and "9074729" are the same identifier written two ways, and an analyst
    // pastes whichever the register gave them. `normalizeExternalId` already knows this;
    // the index carries both forms so neither spelling of the query misses.
    const index = buildSearchIndex({
      entities: [entity({ externalIds: [{ scheme: "imo", value: "9074729" }] })],
    })
    const terms = fieldsOf(index, "external-id")[0].terms
    expect(terms).toContain("9074729")
    expect(terms).toContain("imo 9074729")
  })

  it("indexes notes", () => {
    const index = buildSearchIndex({ entities: [entity({ notes: "Registered at 12 Ostozhenka" })] })
    expect(fieldsOf(index, "notes")[0].text).toBe("Registered at 12 Ostozhenka")
  })

  it("indexes a claim's value under the field it was asserted about", () => {
    const index = buildSearchIndex({
      entities: [entity()],
      claims: [{ entityId: "e1", field: "address", value: "12 Ostozhenka", sourceId: "s1" }],
    })
    expect(fieldsOf(index, "claim")[0]).toMatchObject({
      entityId: "e1",
      label: "address",
      text: "12 Ostozhenka",
    })
  })

  it("skips the general-citation claim, which asserts no value", () => {
    // `field: "sources"` with a null value is the sentinel for a citation not tied to any
    // field (ADR 0006). It carries no text, so indexing it would only add empty fields.
    const index = buildSearchIndex({
      entities: [entity()],
      claims: [{ entityId: "e1", field: "sources", value: null, sourceId: "s1" }],
    })
    expect(fieldsOf(index, "claim")).toEqual([])
  })

  it("reaches a Source through the claim that cites it", () => {
    // Sources are not entity-keyed (they live in the peripheral provenance store), so the
    // claim is the only thing that says which entity a URL is evidence for. Without this
    // join, a Ledger URL is searchable but leads nowhere an analyst can click.
    const index = buildSearchIndex({
      entities: [entity()],
      claims: [{ entityId: "e1", field: "sources", value: null, sourceId: "s1" }],
      sources: [{ id: "s1", url: "https://rusprofile.ru/id/12345" }],
    })
    expect(fieldsOf(index, "source")[0]).toMatchObject({
      entityId: "e1",
      text: "https://rusprofile.ru/id/12345",
    })
  })

  it("indexes a Source once per entity, however many claims cite it", () => {
    const index = buildSearchIndex({
      entities: [entity()],
      claims: [
        { entityId: "e1", field: "sources", value: null, sourceId: "s1" },
        { entityId: "e1", field: "address", value: "12 Ostozhenka", sourceId: "s1" },
      ],
      sources: [{ id: "s1", url: "https://rusprofile.ru/id/12345" }],
    })
    expect(fieldsOf(index, "source")).toHaveLength(1)
  })

  it("drops a claim whose entity is not in the corpus", () => {
    // A hit that cannot be selected is worse than no hit: the dropdown would offer a row
    // that resolves to nothing.
    const index = buildSearchIndex({
      entities: [entity()],
      claims: [{ entityId: "gone", field: "address", value: "12 Ostozhenka", sourceId: "s1" }],
    })
    expect(fieldsOf(index, "claim")).toEqual([])
  })

  it("drops a field with no matchable content rather than indexing an empty term", () => {
    // An empty normalised term is a substring of every query, so keeping one would make
    // that field match everything typed.
    const index = buildSearchIndex({
      entities: [entity({ name: "Wagner Group", aliases: ["", "   ", "!!!"], notes: "" })],
    })
    expect(fieldsOf(index, "alias")).toEqual([])
    expect(fieldsOf(index, "notes")).toEqual([])
  })

  it("carries the entity kind on every field, so a hit can be grouped without a second lookup", () => {
    const index = buildSearchIndex({
      entities: [entity({ kind: "vessel", aliases: ["Ursa Major"], notes: "n" })],
    })
    for (const field of index.fields) expect(field.kind).toBe("vessel")
  })
})

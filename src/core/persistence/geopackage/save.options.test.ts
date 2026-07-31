import { describe, expect, it } from "vitest"
import type { SaveGeoPackageOptions } from "./index"

/**
 * A type-level test, deliberately with no WASM and no saveGeoPackage call: its subject is the
 * compiler. Eight values, each omitting exactly one of the eight members under its own
 * directive, so that any single member turning optional makes that one value legal, leaves its
 * directive unused, and fails `npx tsc -b` with "Unused '@ts-expect-error' directive". One
 * value would only ever pin one member: the object stays erroneous while any other member is
 * still missing. A save replaces every table it owns (save.ts DELETEs then rewrites), so an
 * omitted key is a silently wiped table.
 */
describe("SaveGeoPackageOptions", () => {
  it("makes omitting a table's option a compile error", () => {
    // Each omission below must not compile. Meaning "nothing here" stays expressible for the
    // five nullable members, but only by writing the word undefined.

    // @ts-expect-error layers is required, so omitting it must not compile.
    const missingLayers: SaveGeoPackageOptions = {
      entities: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error entities is required, so omitting it must not compile.
    const missingEntities: SaveGeoPackageOptions = {
      layers: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error geometries is required, so omitting it must not compile.
    const missingGeometries: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      researchSources: undefined,
      baseBuffer: undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error researchSources is required, so omitting it must not compile.
    const missingResearchSources: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      geometries: [],
      baseBuffer: undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error baseBuffer is required, so omitting it must not compile.
    const missingBaseBuffer: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      geometries: [],
      researchSources: undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error sources is required, so omitting it must not compile.
    const missingSources: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: undefined,
      claims: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error claims is required, so omitting it must not compile.
    const missingClaims: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: undefined,
      sources: undefined,
      ratingEvents: undefined,
    }

    // @ts-expect-error ratingEvents is required, so omitting it must not compile.
    const missingRatingEvents: SaveGeoPackageOptions = {
      layers: [],
      entities: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: undefined,
      sources: undefined,
      claims: undefined,
    }

    const cases: ReadonlyArray<readonly [keyof SaveGeoPackageOptions, SaveGeoPackageOptions]> = [
      ["layers", missingLayers],
      ["entities", missingEntities],
      ["geometries", missingGeometries],
      ["researchSources", missingResearchSources],
      ["baseBuffer", missingBaseBuffer],
      ["sources", missingSources],
      ["claims", missingClaims],
      ["ratingEvents", missingRatingEvents],
    ]

    // Every member of the type is covered by exactly one omission, and each value really does
    // omit its own member and nothing else — a copy-paste slip would leave a member unpinned.
    expect(cases).toHaveLength(8)
    for (const [member, value] of cases) {
      expect(Object.keys(value)).not.toContain(member)
      expect(Object.keys(value)).toHaveLength(7)
    }
  })
})

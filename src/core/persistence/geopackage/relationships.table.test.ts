import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Relationship } from "@/core/relationship/relationship"
import { tableExists, type ColumnDescriptor, type DecodeContext } from "./columnDescriptor"
import { saveGeoPackage } from "./index"
import {
  RELATIONSHIPS_TABLE,
  createRelationshipsTable,
  readRelationships,
  relationshipColumns,
  writeRelationships,
} from "./relationships.table"

/**
 * Written from `docs/timelines/SLICE_2B_CRITERIA.md` criteria 25-28, not from the
 * module's observed behaviour.
 *
 * Real WASM throughout (`CONSTRAINTS.md:96-102`, Prohibition 3): no mocking of the
 * GeoPackage layer. `public/project.gpkg` is read with `readFileSync` and never
 * written; everything after the read happens on in-memory buffers.
 */

const REAL_PROJECT = "public/project.gpkg"

function realProjectBuffer(): ArrayBuffer {
  // Copy into a fresh ArrayBuffer: Node pools small readFileSync results into a shared
  // backing buffer, so `.buffer` alone can carry a nonzero byteOffset.
  const fileBytes = readFileSync(resolve(process.cwd(), REAL_PROJECT))
  return Uint8Array.from(fileBytes).buffer
}

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create("gabriel-test-" + crypto.randomUUID() + ".gpkg")
  geoPackage.createRequiredTables()
  return geoPackage
}

function descriptorFor(column: string): ColumnDescriptor<Relationship> {
  const found = relationshipColumns.find((d) => d.column === column)
  if (found == null) throw new Error("relationships.table declares no column " + column)
  return found
}

/** `decodeRow` supplies this; the per-column tests below decode one value at a time. */
const EMPTY_CTX: DecodeContext<Relationship> = { row: {}, decoded: {} }

const SAMPLE_EDGE: Relationship = {
  id: "hier:child-1",
  fromId: "child-1",
  toId: "parent-1",
  type: "corporate_parent",
  startDate: null,
  endDate: null,
  metadata: {},
}

describe("relationships.table", () => {
  afterEach(() => {
    // If a baseBuffer is ever dropped, save.ts' create-with-retry pool litters the repo
    // root with gabriel-*.gpkg; criterion 75 checks the repo is clean afterwards.
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  })

  // --- criterion 25 (T9) ----------------------------------------------------------
  describe("metadata", () => {
    it("decodes null, undefined, an empty string and malformed JSON to {} and never to undefined", () => {
      const metadata = descriptorFor("metadata")
      for (const raw of [null, undefined, "", "not json"]) {
        const decoded = metadata.decode(raw, EMPTY_CTX)
        // `Relationship.metadata` is required (`relationship.ts:49`, no `?`), so decoding
        // to `undefined` would produce a value the type says cannot exist.
        expect(decoded).toEqual({})
        expect(decoded).not.toBeUndefined()
        expect(decoded).toBeDefined()
      }
    })

    it("encodes an empty metadata bag to null and never to the literal string {}", () => {
      const metadata = descriptorFor("metadata")
      // `encodeRatingMeta` does not test emptiness; copying it would persist "{}" on
      // every edge that carries none.
      expect(metadata.encode({}, SAMPLE_EDGE)).toBeNull()
      expect(metadata.encode({}, SAMPLE_EDGE)).not.toBe("{}")
    })

    it("encodes a populated metadata bag to a JSON string", () => {
      const metadata = descriptorFor("metadata")
      const encoded = metadata.encode({ percent: 25 }, SAMPLE_EDGE)
      expect(typeof encoded).toBe("string")
      expect(JSON.parse(String(encoded)) as unknown).toEqual({ percent: 25 })
    })
  })

  // --- criterion 26 (T5) ----------------------------------------------------------
  describe("export_override", () => {
    it("decodes null to undefined and never to {}", () => {
      const decoded = descriptorFor("export_override").decode(null, EMPTY_CTX)
      // Absence is a distinct state from an empty override: `{}` would read as an
      // override that exists but says nothing, which the export gate must never see.
      expect(decoded).toBeUndefined()
      expect(decoded).not.toEqual({})
    })

    it("encodes undefined to null", () => {
      expect(descriptorFor("export_override").encode(undefined, SAMPLE_EDGE)).toBeNull()
    })
  })

  // --- criterion 27 (T11), the load-bearing deviation ------------------------------
  describe("readRelationships", () => {
    it(
      "returns null for an absent table, read from the real project file",
      async () => {
        const geoPackage = await GeoPackageAPI.open(new Uint8Array(realProjectBuffer()))
        try {
          // The real file has no `relationships` table, which is what makes `null`
          // observable at all — the migration gates on exactly this.
          expect(tableExists(geoPackage.connection, RELATIONSHIPS_TABLE)).toBe(false)
          expect(readRelationships(geoPackage)).toBeNull()
        } finally {
          geoPackage.close()
        }
      },
      60_000,
    )

    it(
      "returns [] for an empty table that really exists",
      async () => {
        const buffer = realProjectBuffer()
        const bytes = await saveGeoPackage({
          layers: [],
          entities: [],
          geometries: [],
          researchSources: undefined,
          baseBuffer: buffer,
          sources: undefined,
          claims: undefined,
          ratingEvents: undefined,
          relationships: [],
          integrityEvents: [],
        })
        const saved = await GeoPackageAPI.open(new Uint8Array(bytes))
        try {
          // The artefact, not a count: without this, `[]` could be an absent table in
          // disguise and the deviation above would be untested.
          expect(tableExists(saved.connection, RELATIONSHIPS_TABLE)).toBe(true)
          expect(readRelationships(saved)).toEqual([])
          expect(readRelationships(saved)).not.toBeNull()
        } finally {
          saved.close()
        }
      },
      60_000,
    )
  })

  // --- criterion 28 -----------------------------------------------------------------
  it(
    "reads rows back in insertion order (ORDER BY rowid ASC), not id order",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createRelationshipsTable(geoPackage)
        // These carry non-empty metadata on purpose, so that this test reports on read
        // ORDER and nothing else. The `{}` case has its own test below, and it is red:
        // `metadata NOT NULL` (criterion 22) and an encoder that emits `null` for an
        // empty bag (criterion 25) cannot both hold on the same INSERT.
        const edges: Relationship[] = [
          { ...SAMPLE_EDGE, id: "hier:c", fromId: "c", toId: "p", metadata: { percent: 1 } },
          { ...SAMPLE_EDGE, id: "hier:a", fromId: "a", toId: "p", metadata: { percent: 2 } },
          { ...SAMPLE_EDGE, id: "hier:b", fromId: "b", toId: "p", metadata: { percent: 3 } },
        ]
        writeRelationships(geoPackage, edges)
        const read = readRelationships(geoPackage)
        expect(read).not.toBeNull()
        expect((read ?? []).map((rel) => rel.id)).toEqual(["hier:c", "hier:a", "hier:b"])
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )

  /**
   * The shape criterion 39 says every minted edge has, written through the shipped
   * write path `save.ts:125` uses. `{}` metadata is what ~1010 of the 1012 migrated
   * edges carry, so if this cannot be written, the real migration cannot be saved.
   */
  it(
    // Deliberately does NOT contain the word criterion 25 filters on: this test is red
    // for a different reason, and `-t` must not drag it into criterion 25's verdict.
    "round-trips a minted edge whole: an empty bag, null dates, no exportOverride",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createRelationshipsTable(geoPackage)
        const bare: Relationship = { ...SAMPLE_EDGE }
        const priced: Relationship = {
          id: "hier:child-2",
          fromId: "child-2",
          toId: "parent-1",
          type: "corporate_parent",
          startDate: null,
          endDate: null,
          metadata: { percent: 49.9 },
        }
        writeRelationships(geoPackage, [bare, priced])
        const read = readRelationships(geoPackage) ?? []
        expect(read).toEqual([bare, priced])
        expect(read[0]?.metadata).toEqual({})
        expect(read[0]?.exportOverride).toBeUndefined()
        expect(read[0]?.startDate).toBeNull()
        expect(read[1]?.metadata.percent).toBe(49.9)
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )
})

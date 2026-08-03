import { readFileSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import { tableExists, type ColumnDescriptor, type DecodeContext } from "./columnDescriptor"
import {
  INTEGRITY_EVENTS_TABLE,
  createIntegrityEventsTable,
  integrityEventColumns,
  readIntegrityEvents,
  writeIntegrityEvents,
} from "./integrityEvents.table"

/**
 * Written from `docs/timelines/SLICE_2B_CRITERIA.md` criteria 30 and 31.
 *
 * Real WASM throughout (`CONSTRAINTS.md:96-102`, Prohibition 3). `public/project.gpkg`
 * is read with `readFileSync` and never written; everything after the read happens on
 * in-memory buffers.
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

function descriptorFor(column: string): ColumnDescriptor<IntegrityEvent> {
  const found = integrityEventColumns.find((d) => d.column === column)
  if (found == null) throw new Error("integrityEvents.table declares no column " + column)
  return found
}

const EMPTY_CTX: DecodeContext<IntegrityEvent> = { row: {}, decoded: {} }

const SAMPLE_EVENT: IntegrityEvent = {
  id: "integrity:hierarchy-migrated",
  kind: "hierarchy-migrated",
  createdAt: "2026-07-31T00:00:00.000Z",
  summary: "One sentence an analyst reads.",
  detail: {},
}

describe("integrityEvents.table", () => {
  afterEach(() => {
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

  // --- criterion 30 -----------------------------------------------------------------
  it(
    "returns [] and never null for an absent table, read from the real project file",
    async () => {
      const geoPackage = await GeoPackageAPI.open(new Uint8Array(realProjectBuffer()))
      try {
        expect(tableExists(geoPackage.connection, INTEGRITY_EVENTS_TABLE)).toBe(false)
        const events = readIntegrityEvents(geoPackage)
        // The ordinary house pattern. Only `readRelationships` deviates, because only
        // the hierarchy migration gates on a table being absent; this asymmetry is
        // deliberate, and this assertion is what pins it.
        expect(events).toEqual([])
        expect(events).not.toBeNull()
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )

  // --- criterion 31 (T9) ------------------------------------------------------------
  describe("detail", () => {
    it("decodes null, undefined, an empty string and malformed JSON to {} and never to undefined", () => {
      const detail = descriptorFor("detail")
      for (const raw of [null, undefined, "", "not json"]) {
        const decoded = detail.decode(raw, EMPTY_CTX)
        // `IntegrityEvent.detail` is required (`integrityEvent.ts:35`, no `?`).
        expect(decoded).toEqual({})
        expect(decoded).not.toBeUndefined()
        expect(decoded).toBeDefined()
      }
    })

    it("encodes a payload with no own enumerable keys to null, never to the string {}", () => {
      const detail = descriptorFor("detail")
      expect(detail.encode({}, SAMPLE_EVENT)).toBeNull()
      expect(detail.encode({}, SAMPLE_EVENT)).not.toBe("{}")
    })

    it("encodes a populated detail payload to a JSON string", () => {
      const detail = descriptorFor("detail")
      const encoded = detail.encode({ mintedEdges: 1012 }, SAMPLE_EVENT)
      expect(typeof encoded).toBe("string")
      expect(JSON.parse(String(encoded)) as unknown).toEqual({ mintedEdges: 1012 })
    })
  })

  // --- the fail-closed decoder on the READ path -------------------------------------
  it(
    "drops a structurally invalid row instead of returning it typed, and says so",
    async () => {
      const geoPackage = await createTestGeoPackage()
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      try {
        createIntegrityEventsTable(geoPackage)
        writeIntegrityEvents(geoPackage, [SAMPLE_EVENT])
        // Written by a foreign tool or a hand edit: the column decoders coerce, so without
        // `decodeIntegrityEvent` this row would reach the store typed as an IntegrityEventKind
        // and be re-written verbatim on the next save.
        geoPackage.connection.run(
          `INSERT INTO ${INTEGRITY_EVENTS_TABLE} (id, kind, created_at, summary, detail)` +
            " VALUES ('integrity:bad-kind', 'whatever', '2026-07-31T00:00:00.000Z', 's', NULL)",
        )
        geoPackage.connection.run(
          `INSERT INTO ${INTEGRITY_EVENTS_TABLE} (id, kind, created_at, summary, detail)` +
            " VALUES ('', 'cross-kind-parent', '2026-07-31T00:00:00.000Z', 's', NULL)",
        )

        const read = readIntegrityEvents(geoPackage)
        // Not a throw: a corrupt integrity row must never make a project unopenable.
        expect(read).toEqual([SAMPLE_EVENT])
        expect(warn).toHaveBeenCalledTimes(1)
      } finally {
        warn.mockRestore()
        geoPackage.close()
      }
    },
    60_000,
  )

  // --- criterion 28's ordering clause, and the write/read contract ------------------
  it(
    "round-trips events in append order (ORDER BY rowid ASC), with detail {} surviving",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createIntegrityEventsTable(geoPackage)
        const events: IntegrityEvent[] = [
          { ...SAMPLE_EVENT, id: "integrity:second", kind: "cross-kind-parent" },
          { ...SAMPLE_EVENT, id: "integrity:first", detail: { childId: "e-1" } },
        ]
        writeIntegrityEvents(geoPackage, events)
        const read = readIntegrityEvents(geoPackage)
        expect(read.map((e) => e.id)).toEqual(["integrity:second", "integrity:first"])
        expect(read).toEqual(events)
        expect(read[0]?.detail).toEqual({})
        expect(read[0]?.acknowledgedAt).toBeUndefined()
      } finally {
        geoPackage.close()
      }
    },
    60_000,
  )
})

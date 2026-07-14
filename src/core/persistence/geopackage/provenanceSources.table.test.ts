import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Source } from "@/core/provenance/source"
import {
  createProvenanceSourcesTable,
  readProvenanceSources,
  writeProvenanceSources,
} from "./provenanceSources.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("provenanceSources.table", () => {
  afterEach(() => {
    for (const file of readdirSync(process.cwd())) {
      if (file.startsWith("gabriel-test-") && file.endsWith(".gpkg")) {
        try {
          rmSync(file, { force: true })
        } catch {
          // ignore: file is locked by another concurrently-running test worker
        }
      }
    }
  })

  it(
    "round-trips every field through write -> read",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createProvenanceSourcesTable(geoPackage)
        const source: Source = { id: "src-1", url: "https://example.org/a", domainType: "web", reliability: "B" }
        writeProvenanceSources(geoPackage, [source])
        expect(readProvenanceSources(geoPackage)).toEqual([source])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "round-trips null domainType/reliability",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createProvenanceSourcesTable(geoPackage)
        const source: Source = { id: "src-1", url: "https://example.org/a", domainType: null, reliability: null }
        writeProvenanceSources(geoPackage, [source])
        expect(readProvenanceSources(geoPackage)).toEqual([source])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("round-trips interestedParty: true, and omits it when never set", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceSourcesTable(geoPackage)
      const flagged: Source = { id: "src-1", url: "https://tass.com/a", domainType: "official", reliability: "D", interestedParty: true }
      const unflagged: Source = { id: "src-2", url: "https://example.org/a", domainType: "web", reliability: null }
      writeProvenanceSources(geoPackage, [flagged, unflagged])
      const loaded = readProvenanceSources(geoPackage)
      expect(loaded.find((s) => s.id === "src-1")?.interestedParty).toBe(true)
      expect(loaded.find((s) => s.id === "src-2")?.interestedParty).toBeUndefined()
    } finally {
      geoPackage.close()
    }
  })

  it("does not error or duplicate rows when called twice on the same open connection", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceSourcesTable(geoPackage)
      const source: Source = { id: "src-1", url: "https://example.org/a", domainType: "web", reliability: null }
      writeProvenanceSources(geoPackage, [source])
      writeProvenanceSources(geoPackage, [source])
      expect(readProvenanceSources(geoPackage)).toEqual([source])
    } finally {
      geoPackage.close()
    }
  })

  it("returns an empty array when the table does not exist (pre-E2 projects)", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      expect(readProvenanceSources(geoPackage)).toEqual([])
    } finally {
      geoPackage.close()
    }
  })

  it("round-trips reliabilityMeta as JSON", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceSourcesTable(geoPackage)
      const source: Source = {
        id: "src-1",
        url: "https://example.org/a",
        domainType: "official",
        reliability: "C",
        reliabilityMeta: {
          confidence: 0.5,
          rationale: "official domain",
          assessor: { kind: "type-table", mappingVersion: "v1" },
          mappingVersion: "v1",
          updatedAt: "2026-07-14T00:00:00.000Z",
          overridden: false,
        },
      }
      writeProvenanceSources(geoPackage, [source])
      expect(readProvenanceSources(geoPackage)).toEqual([source])
    } finally {
      geoPackage.close()
    }
  })

  it("omits reliabilityMeta from a decoded source that never had it set", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceSourcesTable(geoPackage)
      const source: Source = { id: "src-1", url: "https://example.org/a", domainType: "web", reliability: null }
      writeProvenanceSources(geoPackage, [source])
      const [loaded] = readProvenanceSources(geoPackage)
      expect(loaded.reliabilityMeta).toBeUndefined()
    } finally {
      geoPackage.close()
    }
  })

  it("defaults an invalid persisted reliability value to null", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceSourcesTable(geoPackage)
      geoPackage.connection.run(
        `INSERT INTO provenance_sources (id, url, domain_type, reliability) VALUES (?, ?, ?, ?)`,
        ["src-1", "https://example.org/a", "web", "Z"],
      )
      const [loaded] = readProvenanceSources(geoPackage)
      expect(loaded.reliability).toBeNull()
    } finally {
      geoPackage.close()
    }
  })
})

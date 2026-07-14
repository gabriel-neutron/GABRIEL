import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { Claim } from "@/core/provenance/claim"
import {
  createProvenanceClaimsTable,
  readProvenanceClaims,
  writeProvenanceClaims,
} from "./provenanceClaims.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("provenanceClaims.table", () => {
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
        createProvenanceClaimsTable(geoPackage)
        const claim: Claim = {
          id: "claim-1",
          entityId: "entity-1",
          field: "sources",
          value: null,
          sourceId: "src-1",
          credibility: 3,
          timestamp: "2026-07-08T00:00:00.000Z",
        }
        writeProvenanceClaims(geoPackage, [claim])
        expect(readProvenanceClaims(geoPackage)).toEqual([claim])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it(
    "preserves insertion order (rowid order), not just decode fidelity",
    async () => {
      const geoPackage = await createTestGeoPackage()
      try {
        createProvenanceClaimsTable(geoPackage)
        const claims: Claim[] = [
          { id: "claim-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-2", credibility: null, timestamp: null },
          { id: "claim-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
        ]
        writeProvenanceClaims(geoPackage, claims)
        expect(readProvenanceClaims(geoPackage).map((c) => c.id)).toEqual(["claim-2", "claim-1"])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("returns an empty array when the table does not exist (pre-E2 projects)", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      expect(readProvenanceClaims(geoPackage)).toEqual([])
    } finally {
      geoPackage.close()
    }
  })

  it("round-trips credibilityMeta as JSON", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceClaimsTable(geoPackage)
      const claim: Claim = {
        id: "claim-1",
        entityId: "entity-1",
        field: "sources",
        value: null,
        sourceId: "src-1",
        credibility: 2,
        timestamp: "2026-07-08T00:00:00.000Z",
        credibilityMeta: {
          confidence: 0.4,
          rationale: "single cluster",
          assessor: { kind: "ai", model: "gpt-5", promptVersion: "v1" },
          updatedAt: "2026-07-14T00:00:00.000Z",
          overridden: false,
          evidenceRefs: ["https://a.example"],
          corroborationClusters: 1,
          statedAttribution: null,
        },
      }
      writeProvenanceClaims(geoPackage, [claim])
      expect(readProvenanceClaims(geoPackage)).toEqual([claim])
    } finally {
      geoPackage.close()
    }
  })

  it("omits credibilityMeta from a decoded claim that never had it set", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceClaimsTable(geoPackage)
      const claim: Claim = { id: "claim-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }
      writeProvenanceClaims(geoPackage, [claim])
      const [loaded] = readProvenanceClaims(geoPackage)
      expect(loaded.credibilityMeta).toBeUndefined()
    } finally {
      geoPackage.close()
    }
  })

  it("does not error or duplicate rows when called twice on the same open connection", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceClaimsTable(geoPackage)
      const claim: Claim = { id: "claim-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }
      writeProvenanceClaims(geoPackage, [claim])
      writeProvenanceClaims(geoPackage, [claim])
      expect(readProvenanceClaims(geoPackage)).toEqual([claim])
    } finally {
      geoPackage.close()
    }
  })

  it("orders claims by explicit timestamp, falling back to insertion order only where timestamp is null", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createProvenanceClaimsTable(geoPackage)
      // Insertion order: c-null-1, c-2026, c-null-2, c-2025.
      // Expected read order: timestamped claims sorted ascending (c-2025, c-2026),
      // then untimestamped claims in their original insertion order (c-null-1, c-null-2).
      const claims: Claim[] = [
        { id: "c-null-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
        { id: "c-2026", entityId: "e-1", field: "sources", value: null, sourceId: "src-2", credibility: null, timestamp: "2026-01-01T00:00:00.000Z" },
        { id: "c-null-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-3", credibility: null, timestamp: null },
        { id: "c-2025", entityId: "e-1", field: "sources", value: null, sourceId: "src-4", credibility: null, timestamp: "2025-01-01T00:00:00.000Z" },
      ]
      writeProvenanceClaims(geoPackage, claims)
      expect(readProvenanceClaims(geoPackage).map((c) => c.id)).toEqual(["c-2025", "c-2026", "c-null-1", "c-null-2"])
    } finally {
      geoPackage.close()
    }
  })
})

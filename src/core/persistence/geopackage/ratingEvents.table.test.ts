import { readdirSync, rmSync } from "node:fs"
import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { afterEach, describe, expect, it } from "vitest"
import type { RatingEvent } from "@/core/provenance/ratingEvent"
import { createRatingEventsTable, readRatingEvents, writeRatingEvents } from "./ratingEvents.table"

async function createTestGeoPackage(): Promise<GeoPackage> {
  const geoPackage = await GeoPackageAPI.create(`gabriel-test-${crypto.randomUUID()}.gpkg`)
  geoPackage.createRequiredTables()
  return geoPackage
}

describe("ratingEvents.table", () => {
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
        createRatingEventsTable(geoPackage)
        const event: RatingEvent = {
          id: "evt-1",
          targetType: "source",
          targetId: "src-1",
          kind: "reliability",
          value: "B",
          assessor: { kind: "analyst" },
          timestamp: "2026-07-14T00:00:00.000Z",
        }
        writeRatingEvents(geoPackage, [event])
        expect(readRatingEvents(geoPackage)).toEqual([event])
      } finally {
        geoPackage.close()
      }
    },
    30_000,
  )

  it("returns an empty array when the table does not exist (pre-Phase-4 projects)", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      expect(readRatingEvents(geoPackage)).toEqual([])
    } finally {
      geoPackage.close()
    }
  })

  it("does not error or duplicate rows when called twice on the same open connection", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createRatingEventsTable(geoPackage)
      const event: RatingEvent = {
        id: "evt-1",
        targetType: "claim",
        targetId: "c-1",
        kind: "credibility",
        value: "1",
        assessor: { kind: "analyst" },
        timestamp: "2026-07-14T00:00:00.000Z",
      }
      writeRatingEvents(geoPackage, [event])
      writeRatingEvents(geoPackage, [event])
      expect(readRatingEvents(geoPackage)).toEqual([event])
    } finally {
      geoPackage.close()
    }
  })

  it("preserves append order across multiple events", async () => {
    const geoPackage = await createTestGeoPackage()
    try {
      createRatingEventsTable(geoPackage)
      const events: RatingEvent[] = [
        { id: "evt-1", targetType: "source", targetId: "src-1", kind: "reliability", value: "C", assessor: { kind: "type-table" }, timestamp: "2026-07-01T00:00:00.000Z" },
        { id: "evt-2", targetType: "source", targetId: "src-1", kind: "reliability", value: "B", assessor: { kind: "analyst" }, timestamp: "2026-07-02T00:00:00.000Z" },
      ]
      writeRatingEvents(geoPackage, events)
      expect(readRatingEvents(geoPackage).map((e) => e.id)).toEqual(["evt-1", "evt-2"])
    } finally {
      geoPackage.close()
    }
  })
})

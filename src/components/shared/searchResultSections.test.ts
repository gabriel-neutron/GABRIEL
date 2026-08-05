import { describe, expect, it } from "vitest"
import type { SearchGroup, SearchHit } from "@/core/search/searchQuery"
import type { LocalOsmSearchHit } from "@/modules/osm/services/osmLocalSearch"
import {
  flattenSections,
  hasLocalRows,
  resultSections,
  type CoordinateHit,
  type NominatimHit,
} from "./searchResultSections"

/**
 * The ordering contract between what is painted and what the keyboard walks.
 *
 * `UnifiedSearchDropdown` renders from `resultSections`, and `UnifiedSearch` flattens the same
 * value to decide what ArrowDown highlights and what Enter takes. If those two ever disagree the
 * highlight sits on one row while Enter opens another — a defect that looks like a rendering
 * glitch and is actually the analyst opening the wrong entity. Only the ordering is asserted
 * here; the painting itself has no jsdom to be asserted in.
 */

function hit(entityId: string, entityName: string): SearchHit {
  return {
    entityId, entityName, kind: "unit", field: "name", label: null,
    text: entityName, strength: "exact", score: 100,
  }
}

function group(kind: SearchGroup["kind"], label: string, hits: SearchHit[]): SearchGroup {
  return { kind, label, hits }
}

const COORD: CoordinateHit = {
  source: "coordinates", lat: 55.75, lng: 37.61, display_name: "55.75000, 37.61000",
}
const OSM: LocalOsmSearchHit = {
  source: "local-osm", lat: 1, lng: 2, display_name: "Depot", layerLabel: "OSM",
}
const ONLINE: NominatimHit = {
  source: "nominatim", lat: "1", lon: "2", display_name: "Pretoria", osm_type: "way", osm_id: 7,
}

const EMPTY = { entityGroups: [], coordinateHit: null, osmHits: [], nominatimResults: [] }

describe("resultSections", () => {
  it("emits nothing for an empty search rather than empty sections", () => {
    expect(resultSections(EMPTY)).toEqual([])
    expect(flattenSections(resultSections(EMPTY))).toEqual([])
  })

  it("orders entities, then coordinates, then OSM, then online places", () => {
    const sections = resultSections({
      entityGroups: [group("unit", "Unit", [hit("u1", "First")])],
      coordinateHit: COORD,
      osmHits: [OSM],
      nominatimResults: [ONLINE],
    })
    expect(sections.map((s) => s.key)).toEqual(["kind-unit", "coordinates", "osm", "nominatim"])
  })

  it("flattens to exactly the rows, in exactly the painted order", () => {
    const sections = resultSections({
      entityGroups: [
        group("unit", "Unit", [hit("u1", "First"), hit("u2", "Second")]),
        group("corporate", "Industrial entity", [hit("c1", "Third")]),
      ],
      coordinateHit: COORD,
      osmHits: [OSM],
      nominatimResults: [ONLINE],
    })
    expect(flattenSections(sections).map((r) => r.title))
      .toEqual(["First", "Second", "Third", "55.75000, 37.61000", "Depot", "Pretoria"])
  })

  it("keeps every row reachable: the flat length is the sum of the sections", () => {
    // The invariant an added section would break. Stated as arithmetic so a new section that
    // paints but is never walked fails here rather than in the analyst's hands.
    const sections = resultSections({
      entityGroups: [group("unit", "Unit", [hit("u1", "a"), hit("u2", "b")])],
      coordinateHit: COORD,
      osmHits: [OSM, OSM],
      nominatimResults: [ONLINE],
    })
    const summed = sections.reduce((n, s) => n + s.rows.length, 0)
    expect(flattenSections(sections)).toHaveLength(summed)
    expect(summed).toBe(6)
  })

  it("gives each section the flat index its first row will paint at", () => {
    // `startIndex` is the whole reason the painted highlight and the keyboard index agree. The
    // dropdown paints row `section.startIndex + i`; if that ever stops addressing the same row
    // the flat list holds, ArrowDown highlights one entity and Enter opens another.
    const sections = resultSections({
      entityGroups: [
        group("unit", "Unit", [hit("u1", "a"), hit("u2", "b")]),
        group("corporate", "Industrial entity", [hit("c1", "c")]),
      ],
      coordinateHit: COORD,
      osmHits: [OSM],
      nominatimResults: [ONLINE],
    })
    expect(sections.map((s) => s.startIndex)).toEqual([0, 2, 3, 4, 5])

    const flat = flattenSections(sections)
    for (const section of sections) {
      section.rows.forEach((row, i) => {
        expect(flat[section.startIndex + i]).toBe(row)
      })
    }
  })

  it("carries the result each row selects, not just its title", () => {
    const rows = flattenSections(resultSections({ ...EMPTY, coordinateHit: COORD }))
    expect(rows[0]?.result).toEqual(COORD)
  })

  it("gives every row a distinct key across sections", () => {
    const rows = flattenSections(resultSections({
      entityGroups: [group("unit", "Unit", [hit("u1", "a")])],
      coordinateHit: COORD,
      osmHits: [OSM, OSM],
      nominatimResults: [ONLINE],
    }))
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })
})

describe("hasLocalRows", () => {
  it("is false when the only rows came back from the network", () => {
    // This is what gates Enter: with online places already on screen and nothing local, the
    // query still matched nothing on the device.
    expect(hasLocalRows(resultSections({ ...EMPTY, nominatimResults: [ONLINE] }))).toBe(false)
  })

  it("is true for entities, coordinates or OSM features alike", () => {
    expect(hasLocalRows(resultSections({ ...EMPTY, coordinateHit: COORD }))).toBe(true)
    expect(hasLocalRows(resultSections({ ...EMPTY, osmHits: [OSM] }))).toBe(true)
    expect(hasLocalRows(resultSections({
      ...EMPTY, entityGroups: [group("unit", "Unit", [hit("u1", "a")])],
    }))).toBe(true)
  })

  it("is false for an empty search", () => {
    expect(hasLocalRows(resultSections(EMPTY))).toBe(false)
  })
})

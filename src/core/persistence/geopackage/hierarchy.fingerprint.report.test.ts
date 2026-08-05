import { describe, expect, it } from "vitest"
import { topologyOf, type FingerprintReport } from "./hierarchy.fingerprint.harness"
import {
  DERIVED_POSITION_UNITS,
  diffMaps,
  diffParents,
  diffPositions,
  formatComparison,
  formatReport,
  positionDiagnosis,
} from "./hierarchy.fingerprint.report"

/**
 * The pure pieces of the step-19 tooling — the diff, its diagnosis, and the topology walk —
 * tested off the real file. Every one of them is reached for exactly when something has gone
 * wrong, which is the worst possible moment to discover the diagnosis is itself wrong, and not
 * one of the faults they name (a broken parent derivation bounded by the 741 derived-position
 * units; a dangling parent; a cycle) can be produced by any file that is on disk today.
 */

function ids(...values: string[]): Set<string> {
  return new Set(values)
}

describe("topologyOf", () => {
  it("reads a forest as a forest and counts the roots", () => {
    const parents = new Map([["a", "root"], ["b", "a"], ["c", "root"]])
    expect(topologyOf(parents, ids("root", "a", "b", "c"))).toEqual({
      roots: 1, danglingParents: [], selfLoops: [], onCycle: [],
    })
  })

  it("names the child whose parent is not in the entity set", () => {
    const topology = topologyOf(new Map([["a", "ghost"]]), ids("a"))
    expect(topology.danglingParents).toEqual(["a"])
    expect(topology.onCycle).toEqual([])
  })

  it("reads a self-loop as both a self-loop and a cycle, because it is both", () => {
    const topology = topologyOf(new Map([["a", "a"]]), ids("a"))
    expect(topology.selfLoops).toEqual(["a"])
    expect(topology.onCycle).toEqual(["a"])
  })

  it("names every member of a cycle and nobody else", () => {
    // The fault §10 pre-flight step 5 asks about and no violation code covers: three entities
    // each claiming a parent, no root, and every count in the file still reading perfect.
    const topology = topologyOf(new Map([["a", "b"], ["b", "c"], ["c", "a"]]), ids("a", "b", "c"))
    expect(topology.onCycle).toEqual(["a", "b", "c"])
    expect(topology.roots).toBe(0)
  })

  it("does not put a chain that merely leads into a cycle on the cycle", () => {
    const parents = new Map([["lead", "b"], ["b", "c"], ["c", "b"]])
    expect(topologyOf(parents, ids("lead", "b", "c")).onCycle).toEqual(["b", "c"])
  })

  it("finds the cycle whichever entity the walk happens to start from", () => {
    // `settled` short-circuits a chain that reaches an already-walked id, so a cycle reached
    // second must not be swallowed by the memo. Both insertion orders, same answer.
    const forward = new Map([["lead", "b"], ["b", "c"], ["c", "b"]])
    const reverse = new Map([["c", "b"], ["b", "c"], ["lead", "b"]])
    expect(topologyOf(forward, ids("lead", "b", "c")).onCycle)
      .toEqual(topologyOf(reverse, ids("lead", "b", "c")).onCycle)
  })
})

function report(over: Partial<FingerprintReport>): FingerprintReport {
  return {
    path: "fixture.gpkg",
    fileSizeBytes: 1024,
    loaded: {} as FingerprintReport["loaded"],
    index: {} as FingerprintReport["index"],
    hashA: "a".repeat(64),
    hashB: "b".repeat(64),
    hashC: "c".repeat(64),
    parents: new Map(),
    positions: new Map(),
    depths: new Map(),
    entityCount: 0,
    renderedCount: 0,
    relationshipCount: 0,
    contestedCount: 0,
    integrityEventKinds: [],
    topology: { roots: 0, danglingParents: [], selfLoops: [], onCycle: [] },
    tables: [],
    ...over,
  }
}

describe("diffMaps", () => {
  it("separates a changed value from a gained and a lost key", () => {
    const before = new Map([["same", 1], ["moved", 2], ["lost", 3]])
    const after = new Map([["same", 1], ["moved", 9], ["gained", 4]])
    expect(diffMaps(before, after, (a, b) => a === b)).toEqual({
      changed: [{ id: "moved", before: 2, after: 9 }],
      added: ["gained"],
      removed: ["lost"],
    })
  })

  it("does not read a lost key as changed to undefined", () => {
    const diff = diffMaps(new Map([["gone", 1]]), new Map<string, number>(), (a, b) => a === b)
    expect(diff.changed).toEqual([])
    expect(diff.removed).toEqual(["gone"])
  })
})

describe("diffPositions", () => {
  it("compares at the nine decimals Hash B encodes, so the diff cannot disagree with the hash", () => {
    const before = report({ positions: new Map([["u1", [1.0000000001, 2]]]) })
    const after = report({ positions: new Map([["u1", [1.0000000002, 2]]]) })
    // Different numbers, identical at nine decimals: Hash B would not move, so neither does this.
    expect(diffPositions(before, after).changed).toEqual([])
  })

  it("reports a move that Hash B would see", () => {
    const before = report({ positions: new Map([["u1", [55.75, 37.61]]]) })
    const after = report({ positions: new Map([["u1", [55.76, 37.61]]]) })
    expect(diffPositions(before, after).changed).toEqual([
      { id: "u1", before: [55.75, 37.61], after: [55.76, 37.61] },
    ])
  })
})

describe("diffParents", () => {
  it("names the entity that was re-pointed and both ends of the move", () => {
    const before = report({ parents: new Map([["u1", "p1"]]) })
    const after = report({ parents: new Map([["u1", "p2"]]) })
    expect(diffParents(before, after).changed).toEqual([{ id: "u1", before: "p1", after: "p2" }])
  })
})

describe("positionDiagnosis", () => {
  it("says nothing moved when nothing moved", () => {
    expect(positionDiagnosis(0)).toContain("no entity moved")
  })

  it("calls a diff at or below the derived-position units a broken derivation", () => {
    for (const moved of [1, DERIVED_POSITION_UNITS]) {
      const text = positionDiagnosis(moved)
      expect(text).toContain("broken parent derivation")
      expect(text).toContain("ABORT")
    }
  })

  it("calls a larger diff a geometry change, not a derivation fault", () => {
    const text = positionDiagnosis(DERIVED_POSITION_UNITS + 1)
    expect(text).toContain("geometry itself changed")
    expect(text).not.toContain("broken parent derivation")
  })
})

describe("formatReport", () => {
  it("prints an absent table as absent and an empty one as 0", () => {
    const text = formatReport(report({
      tables: [
        { table: "geometries", count: 291, parented: null },
        { table: "units", count: 1010, parented: 999 },
        { table: "research_sources", count: 0, parented: null },
        { table: "rating_events", count: null, parented: null },
      ],
    }))
    expect(text).toContain("research_sources        0")
    expect(text).toContain("rating_events           table absent")
    expect(text).toContain("parent_id not null: 999")
  })

  it("prints all three hashes and the file size, which is what step 19 copies out", () => {
    const text = formatReport(report({ fileSizeBytes: 4_972_544 }))
    expect(text).toContain("a".repeat(64))
    expect(text).toContain("b".repeat(64))
    expect(text).toContain("c".repeat(64))
    expect(text).toContain("4972544")
  })
})

describe("formatComparison", () => {
  it("reads MATCH on every hash when the two files fingerprint identically", () => {
    const before = report({ positions: new Map([["u1", [1, 2]]]), parents: new Map([["u1", "p1"]]) })
    const text = formatComparison(before, before)
    expect(text).not.toContain("DIFFER")
    expect(text).toContain("no entity moved")
  })

  it("names the moved entities when Hash B differs", () => {
    const before = report({ positions: new Map([["u1", [1, 2]]]) })
    const after = report({ hashB: "d".repeat(64), positions: new Map([["u1", [3, 4]]]) })
    const text = formatComparison(before, after)
    expect(text).toContain("Hash B  DIFFER")
    expect(text).toContain("Hash A  MATCH")
    expect(text).toContain("u1  1.000000000,2.000000000 -> 3.000000000,4.000000000")
    expect(text).toContain("broken parent derivation")
  })

  it("distinguishes an entity that lost its rendered position from one that moved", () => {
    const before = report({ positions: new Map([["u1", [1, 2]]]) })
    const after = report({ positions: new Map([["u2", [1, 2]]]) })
    const text = formatComparison(before, after)
    expect(text).toContain("lost a rendered position: u1")
    expect(text).toContain("gained a rendered position: u2")
  })
})

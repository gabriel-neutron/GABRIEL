import { describe, expect, it } from "vitest"
import type { Entity } from "@/core/entity/entity"
import { editDistance, matchesForEntity, nameSimilarity, proposeMatches } from "./matchCandidates"

function unit(id: string, name: string, extra: Partial<Entity> = {}): Entity {
  return { id, name, layerId: "L", parentId: null, kind: "unit", ...extra }
}

describe("editDistance", () => {
  it("is 0 for equal strings and the length for an empty operand", () => {
    expect(editDistance("abc", "abc")).toBe(0)
    expect(editDistance("", "abc")).toBe(3)
    expect(editDistance("abc", "")).toBe(3)
  })

  it("counts single-edit substitutions/insertions/deletions", () => {
    expect(editDistance("vagner", "wagner")).toBe(1)
    expect(editDistance("kitten", "sitting")).toBe(3)
  })
})

describe("nameSimilarity", () => {
  it("is 1 for identical keys and 0 for two empty keys", () => {
    expect(nameSimilarity("wagner", "wagner")).toBe(1)
    expect(nameSimilarity("", "")).toBe(0)
  })
})

describe("proposeMatches", () => {
  it("proposes an exact-normalized match for a Cyrillic name and its Latin spelling", () => {
    const result = proposeMatches([unit("a", "Вагнер"), unit("b", "Wagner")])
    expect(result).toEqual([{ aId: "a", bId: "b", score: 1, reason: "exact-normalized" }])
  })

  it("proposes a similar-name match below exact but above threshold", () => {
    const result = proposeMatches([unit("a", "1st Guards Army"), unit("b", "1st Guard Army")])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ aId: "a", bId: "b", reason: "similar-name" })
    expect(result[0].score).toBeGreaterThan(0.85)
    expect(result[0].score).toBeLessThan(1)
  })

  it("does not propose across different kinds", () => {
    const corporate: Entity = { id: "c", name: "Wagner", layerId: "industry", parentId: null, kind: "corporate", type: "other" }
    expect(proposeMatches([unit("a", "Wagner"), corporate])).toEqual([])
  })

  it("matches on an alias, not just the primary name", () => {
    const a = unit("a", "PMC Wagner", { aliases: ["Вагнер"] })
    const b = unit("b", "Wagner")
    const result = proposeMatches([a, b])
    expect(result).toEqual([{ aId: "a", bId: "b", score: 1, reason: "exact-normalized" }])
  })

  it("ignores entities whose name normalizes to nothing", () => {
    expect(proposeMatches([unit("a", "—"), unit("b", "—")])).toEqual([])
  })

  it("returns candidates sorted by score descending, deterministically", () => {
    const entities = [
      unit("a", "1st Guards Army"),
      unit("b", "1st Guard Army"), // similar to a (< 1)
      unit("c", "1st Guards Army"), // exact to a (= 1)
    ]
    const result = proposeMatches(entities)
    expect(result[0].score).toBe(1)
    expect(result.map((r) => r.score)).toEqual([...result.map((r) => r.score)].sort((x, y) => y - x))
  })

  it("respects a custom threshold", () => {
    const entities = [unit("a", "Alpha Battalion"), unit("b", "Bravo Battalion")]
    expect(proposeMatches(entities, { threshold: 0.99 })).toEqual([])
    expect(proposeMatches(entities, { threshold: 0.5 }).length).toBeGreaterThan(0)
  })
})

describe("matchesForEntity", () => {
  const target = unit("t", "Wagner")
  const others = [unit("a", "Вагнер"), unit("b", "Unrelated"), unit("t", "Wagner")]

  it("returns candidates for one entity against others, always with aId = entity.id", () => {
    const result = matchesForEntity(target, others)
    expect(result).toEqual([{ aId: "t", bId: "a", score: 1, reason: "exact-normalized" }])
  })

  it("skips the entity itself and different-kind entities", () => {
    const corporate: Entity = { id: "c", name: "Wagner", layerId: "industry", parentId: null, kind: "corporate", type: "other" }
    expect(matchesForEntity(target, [corporate, target])).toEqual([])
  })

  it("returns nothing for an entity whose name normalizes to nothing", () => {
    expect(matchesForEntity(unit("x", "—"), others)).toEqual([])
  })
})

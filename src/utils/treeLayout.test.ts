import { describe, expect, it } from "vitest"
import { buildOrbat } from "./orbat"
import { computeTreeXIndex } from "./treeLayout"

type Node = { id: string; parentId: string | null }

function n(id: string, parentId: string | null): Node {
  return { id, parentId }
}

describe("computeTreeXIndex", () => {
  it("assigns increasing x-indexes to leaves left to right", () => {
    const items = [n("root", null), n("a", "root"), n("b", "root")]
    const xIndexById = computeTreeXIndex(buildOrbat(items))
    expect(xIndexById.get("a")).toBe(0)
    expect(xIndexById.get("b")).toBe(1)
  })

  it("centers a parent over its children", () => {
    const items = [n("root", null), n("a", "root"), n("b", "root")]
    const xIndexById = computeTreeXIndex(buildOrbat(items))
    expect(xIndexById.get("root")).toBe(0.5)
  })

  it("includes orphans as roots instead of dropping them", () => {
    const items = [n("root", null), n("orphan", "missing"), n("child", "orphan")]
    const xIndexById = computeTreeXIndex(buildOrbat(items))
    expect(xIndexById.has("orphan")).toBe(true)
    expect(xIndexById.has("child")).toBe(true)
  })

  it("terminates on a cycle instead of infinite-recursing", () => {
    const items = [n("a", "c"), n("b", "a"), n("c", "b")]
    const xIndexById = computeTreeXIndex(buildOrbat(items))
    expect(xIndexById.size).toBe(3)
  })

  it("gives every cycle member a real xIndex, including the synthetic root's own parent", () => {
    // a is the cycle's synthetic root (lexicographically smallest), but its real parentId "c"
    // still resolves to a genuinely rendered node — callers that draw a→c should be able to
    // detect that via xIndexById.has(entity.parentId) rather than orbat.isRoot(entity.id).
    const items = [n("a", "c"), n("b", "a"), n("c", "b")]
    const orbat = buildOrbat(items)
    const xIndexById = computeTreeXIndex(orbat)
    expect(orbat.isRoot("a")).toBe(true)
    expect(xIndexById.has("c")).toBe(true)
  })
})

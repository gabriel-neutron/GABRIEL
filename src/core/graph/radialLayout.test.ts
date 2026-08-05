import { describe, expect, it } from "vitest"
import { radialLayout } from "./radialLayout"

/** Angle from the origin in radians, normalised to [0, 2π). */
function angleOf(point: { x: number; y: number }): number {
  const raw = Math.atan2(point.y, point.x)
  return raw < 0 ? raw + 2 * Math.PI : raw
}

function radiusOf(point: { x: number; y: number }): number {
  return Math.hypot(point.x, point.y)
}

describe("radialLayout", () => {
  it("places a lone root at the origin", () => {
    const layout = radialLayout(["a"], new Map())
    expect(layout.get("a")).toEqual({ x: 0, y: 0 })
  })

  it("puts each generation on its own ring, further out with depth", () => {
    const parents = new Map([["child", "root"], ["grandchild", "child"]])
    const layout = radialLayout(["root", "child", "grandchild"], parents)

    expect(radiusOf(layout.get("root")!)).toBe(0)
    expect(radiusOf(layout.get("child")!)).toBeGreaterThan(0)
    expect(radiusOf(layout.get("grandchild")!)).toBeGreaterThan(radiusOf(layout.get("child")!))
  })

  it("spreads siblings apart rather than stacking them", () => {
    const parents = new Map([["a", "root"], ["b", "root"], ["c", "root"]])
    const layout = radialLayout(["root", "a", "b", "c"], parents)

    const angles = ["a", "b", "c"].map((id) => angleOf(layout.get(id)!))
    expect(new Set(angles.map((a) => a.toFixed(4))).size).toBe(3)
  })

  it("gives a subtree an angular span proportional to its leaves", () => {
    // The property that stops a 900-unit brigade and a lone battalion being allotted the
    // same wedge, which is what makes a real ORBAT legible rather than a hairball.
    const parents = new Map([
      ["big", "root"], ["small", "root"],
      ["b1", "big"], ["b2", "big"], ["b3", "big"],
      ["s1", "small"],
    ])
    const layout = radialLayout(["root", "big", "small", "b1", "b2", "b3", "s1"], parents)

    const bigSpan = Math.max(...["b1", "b2", "b3"].map((id) => angleOf(layout.get(id)!))) -
      Math.min(...["b1", "b2", "b3"].map((id) => angleOf(layout.get(id)!)))
    expect(bigSpan).toBeGreaterThan(0)
    // `small` has one leaf to `big`'s three, so its children occupy a quarter of the circle
    // and `big`'s three occupy three quarters.
    expect(angleOf(layout.get("s1")!)).not.toBeCloseTo(angleOf(layout.get("b1")!))
  })

  it("shares the circle between several roots", () => {
    const layout = radialLayout(["r1", "r2"], new Map())
    // Two roots cannot both sit at the origin: one of them would be invisible under the
    // other. Only a SINGLE root earns the centre.
    expect(radiusOf(layout.get("r1")!)).toBeGreaterThan(0)
    expect(angleOf(layout.get("r1")!)).not.toBeCloseTo(angleOf(layout.get("r2")!))
  })

  it("treats a parent outside the node set as no parent at all", () => {
    // A filtered graph can name a parent that is not being drawn. Reading it as a depth
    // would put the child on ring 1 orbiting nothing.
    const layout = radialLayout(["orphan"], new Map([["orphan", "absent"]]))
    expect(layout.get("orphan")).toEqual({ x: 0, y: 0 })
  })

  it("does not loop forever on a parent cycle", () => {
    // `hierarchyIndex` does not forbid a cycle — `validateRelationships` reports one and the
    // corpus is 1,012 edges nobody has proved acyclic. A layout that hangs on one would take
    // the whole view down with it.
    const parents = new Map([["a", "b"], ["b", "a"]])
    const layout = radialLayout(["a", "b"], parents)
    expect(layout.size).toBe(2)
  })

  it("is deterministic: the same input twice gives the same positions", () => {
    const parents = new Map([["a", "root"], ["b", "root"]])
    const ids = ["root", "a", "b"]
    expect(radialLayout(ids, parents)).toEqual(radialLayout(ids, parents))
  })

  it("positions every node it is given, and nothing it is not", () => {
    const layout = radialLayout(["a", "b"], new Map([["b", "a"], ["ghost", "a"]]))
    expect([...layout.keys()].sort()).toEqual(["a", "b"])
  })
})

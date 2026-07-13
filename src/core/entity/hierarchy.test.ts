import { describe, expect, it } from "vitest"
import { buildOrbat } from "./hierarchy"

type Node = { id: string; parentId: string | null }

function n(id: string, parentId: string | null): Node {
  return { id, parentId }
}

describe("buildOrbat", () => {
  describe("roots", () => {
    it("treats null parentId as a root", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a")])
      expect(orbat.roots().map((i) => i.id)).toEqual(["a"])
    })

    it("treats an orphan (parentId set but absent) as a root", () => {
      const orbat = buildOrbat([n("a", "missing"), n("b", "a")])
      expect(orbat.roots().map((i) => i.id)).toEqual(["a"])
    })

    it("treats a 2-cycle as its own root, picking the lexicographically smallest id", () => {
      const orbat = buildOrbat([n("b", "a"), n("a", "b")])
      expect(orbat.roots().map((i) => i.id)).toEqual(["a"])
    })

    it("treats a self-referencing item as a root", () => {
      const orbat = buildOrbat([n("a", "a")])
      expect(orbat.roots().map((i) => i.id)).toEqual(["a"])
    })

    it("gives every disconnected cycle its own root", () => {
      const orbat = buildOrbat([n("x", null), n("b", "a"), n("a", "b")])
      expect(orbat.roots().map((i) => i.id).sort()).toEqual(["a", "x"])
    })
  })

  describe("isRoot", () => {
    it("returns true only for roots", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a")])
      expect(orbat.isRoot("a")).toBe(true)
      expect(orbat.isRoot("b")).toBe(false)
    })

    it("returns false for an unknown id", () => {
      const orbat = buildOrbat([n("a", null)])
      expect(orbat.isRoot("unknown")).toBe(false)
    })
  })

  describe("childrenOf", () => {
    it("returns direct children in insertion order", () => {
      const orbat = buildOrbat([n("a", null), n("c", "a"), n("b", "a")])
      expect(orbat.childrenOf("a").map((i) => i.id)).toEqual(["c", "b"])
    })

    it("returns an empty array for a leaf or unknown id", () => {
      const orbat = buildOrbat([n("a", null)])
      expect(orbat.childrenOf("a")).toEqual([])
      expect(orbat.childrenOf("unknown")).toEqual([])
    })
  })

  describe("depthOf", () => {
    it("assigns depth 0 to roots and increments down the tree", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "b")])
      expect(orbat.depthOf("a")).toBe(0)
      expect(orbat.depthOf("b")).toBe(1)
      expect(orbat.depthOf("c")).toBe(2)
    })

    it("assigns depth 0 to an orphan root and depths its descendants relative to it", () => {
      const orbat = buildOrbat([n("a", "missing"), n("b", "a")])
      expect(orbat.depthOf("a")).toBe(0)
      expect(orbat.depthOf("b")).toBe(1)
    })

    it("resolves depth for cyclic components relative to their synthetic root", () => {
      const orbat = buildOrbat([n("a", "c"), n("b", "a"), n("c", "b")])
      expect(orbat.depthOf("a")).toBe(0)
      expect(orbat.depthOf("b")).toBe(1)
      expect(orbat.depthOf("c")).toBe(2)
    })

    it("returns -1 for an unknown id", () => {
      const orbat = buildOrbat([n("a", null)])
      expect(orbat.depthOf("unknown")).toBe(-1)
    })
  })

  describe("ancestors", () => {
    it("walks up from nearest to furthest", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "b")])
      expect(orbat.ancestors("c").map((i) => i.id)).toEqual(["b", "a"])
    })

    it("returns an empty array for a root", () => {
      const orbat = buildOrbat([n("a", null)])
      expect(orbat.ancestors("a")).toEqual([])
    })

    it("respects maxUp", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "b")])
      expect(orbat.ancestors("c", 1).map((i) => i.id)).toEqual(["b"])
    })

    it("stops at an orphan parent without throwing", () => {
      const orbat = buildOrbat([n("a", "missing"), n("b", "a")])
      expect(orbat.ancestors("b").map((i) => i.id)).toEqual(["a"])
    })

    it("terminates instead of looping forever on a cycle", () => {
      const orbat = buildOrbat([n("a", "b"), n("b", "a")])
      expect(orbat.ancestors("a").map((i) => i.id)).toEqual(["b"])
    })

    it("terminates on a self-referencing item", () => {
      const orbat = buildOrbat([n("a", "a")])
      expect(orbat.ancestors("a")).toEqual([])
    })
  })

  describe("descendants", () => {
    it("returns all descendants in BFS order", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "a"), n("d", "b")])
      expect(orbat.descendants("a").map((i) => i.id)).toEqual(["b", "c", "d"])
    })

    it("respects maxDown", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("d", "b")])
      expect(orbat.descendants("a", 1).map((i) => i.id)).toEqual(["b"])
    })

    it("returns an empty array for a leaf", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a")])
      expect(orbat.descendants("b")).toEqual([])
    })

    it("terminates instead of looping forever on a cycle", () => {
      const orbat = buildOrbat([n("a", "b"), n("b", "a")])
      expect(orbat.descendants("a").map((i) => i.id)).toEqual(["b"])
    })
  })

  describe("layers", () => {
    it("groups items into BFS waves from structural roots", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "a"), n("d", "b")])
      expect(orbat.layers().map((layer) => layer.map((i) => i.id))).toEqual([
        ["a"],
        ["b", "c"],
        ["d"],
      ])
    })

    it("treats orphans as their own root layer alongside structural roots", () => {
      const orbat = buildOrbat([n("a", null), n("orphan", "missing"), n("child", "orphan")])
      expect(orbat.layers()[0].map((i) => i.id).sort()).toEqual(["a", "orphan"])
      expect(orbat.layers()[1].map((i) => i.id)).toEqual(["child"])
    })

    it("appends disconnected cycles as trailing layers after all reachable items", () => {
      const orbat = buildOrbat([n("root", null), n("child", "root"), n("x", "y"), n("y", "x")])
      const layers = orbat.layers()
      const flat = layers.flat().map((i) => i.id)
      expect(flat.sort()).toEqual(["child", "root", "x", "y"])
      // root's component is fully laid out before the cycle component starts
      const rootLayerIdx = layers.findIndex((l) => l.some((i) => i.id === "root"))
      const cycleLayerIdx = layers.findIndex((l) => l.some((i) => i.id === "x" || i.id === "y"))
      expect(cycleLayerIdx).toBeGreaterThan(rootLayerIdx)
    })

    it("respects maxLayers and does not misinterpret truncated items as new roots", () => {
      const orbat = buildOrbat([n("a", null), n("b", "a"), n("c", "b")])
      const layers = orbat.layers(2)
      expect(layers.map((layer) => layer.map((i) => i.id))).toEqual([["a"], ["b"]])
    })

    it("returns an empty array for an empty item list", () => {
      const orbat = buildOrbat([])
      expect(orbat.layers()).toEqual([])
    })
  })

  describe("generic over shapes beyond {id, parentId}", () => {
    it("works with extra fields on the item", () => {
      type Organisation = { id: string; parentId: string | null; name: string }
      const orbat = buildOrbat<Organisation>([
        { id: "a", parentId: null, name: "Holding" },
        { id: "b", parentId: "a", name: "Subsidiary" },
      ])
      expect(orbat.roots().map((o) => o.name)).toEqual(["Holding"])
      expect(orbat.childrenOf("a").map((o) => o.name)).toEqual(["Subsidiary"])
    })
  })
})

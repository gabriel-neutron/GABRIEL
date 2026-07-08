import { describe, expect, it } from "vitest"
import { setSourceReliability } from "./admiralty"
import type { Source } from "./source"

describe("setSourceReliability", () => {
  const sources: Source[] = [
    { id: "src-1", url: "https://a.example", domainType: "web", reliability: null },
    { id: "src-2", url: "https://b.example", domainType: "web", reliability: null },
  ]

  it("sets the rating on the matching source only", () => {
    const result = setSourceReliability(sources, "src-1", "B")
    expect(result.find((s) => s.id === "src-1")?.reliability).toBe("B")
    expect(result.find((s) => s.id === "src-2")?.reliability).toBeNull()
  })

  it("clears a rating back to null", () => {
    const rated = setSourceReliability(sources, "src-1", "B")
    const cleared = setSourceReliability(rated, "src-1", null)
    expect(cleared.find((s) => s.id === "src-1")?.reliability).toBeNull()
  })

  it("is a no-op array-shaped change when the id doesn't match anything", () => {
    const result = setSourceReliability(sources, "src-missing", "A")
    expect(result).toEqual(sources)
  })
})

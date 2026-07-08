import { describe, expect, it } from "vitest"
import { dedupeSources, type Source } from "./source"

describe("dedupeSources", () => {
  it("mints a new Source for each first-seen URL, classifying its domain type", () => {
    const result = dedupeSources(["https://en.wikipedia.org/wiki/X", "https://example.com/a"], [])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(expect.objectContaining({ url: "https://en.wikipedia.org/wiki/X", domainType: "wikipedia", reliability: null }))
    expect(result[1]).toEqual(expect.objectContaining({ url: "https://example.com/a", domainType: "web", reliability: null }))
  })

  it("reuses an existing Source's id/reliability rather than minting a new one for a known URL", () => {
    const existing: Source[] = [
      { id: "src-1", url: "https://example.com/a", domainType: "web", reliability: "B" },
    ]
    const result = dedupeSources(["https://example.com/a"], existing)
    expect(result).toEqual(existing)
    expect(result).toHaveLength(1)
  })

  it("does not merge two URLs that differ only by trailing slash (exact match only, per ADR 0006's identity-vs-dedup split)", () => {
    const result = dedupeSources(["https://example.com/a", "https://example.com/a/"], [])
    expect(result).toHaveLength(2)
  })

  it("ignores empty/whitespace-only URLs", () => {
    expect(dedupeSources(["", "   "], [])).toEqual([])
  })

  it("is idempotent: deduping the same URLs against its own prior output adds nothing new", () => {
    const first = dedupeSources(["https://example.com/a", "https://example.com/b"], [])
    const second = dedupeSources(["https://example.com/a", "https://example.com/b"], first)
    expect(second).toEqual(first)
  })
})

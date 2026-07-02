import { describe, expect, it } from "vitest"
import { merge, parse, rankCitations, selectTopCitations, serialize, shouldPropose } from "./provenance-ledger"
import type { EnrichmentSource } from "@/types/enrichment.types"

function makeSource(overrides: Partial<EnrichmentSource>): EnrichmentSource {
  return {
    url: "https://example.com/article",
    title: "Example",
    snippet: "Evidence snippet.",
    domainType: "web",
    ...overrides,
  }
}

describe("parse", () => {
  it("returns [] for null, undefined, and empty string", () => {
    expect(parse(null)).toEqual([])
    expect(parse(undefined)).toEqual([])
    expect(parse("")).toEqual([])
  })

  it("returns [] for a whitespace-only string", () => {
    expect(parse("   \n  \n")).toEqual([])
  })

  it("parses a single URL", () => {
    expect(parse("https://example.com/a")).toEqual(["https://example.com/a"])
  })

  it("parses multiple lines, filtering blanks and trimming", () => {
    expect(parse("https://example.com/a\n\n  https://example.com/b  \n")).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ])
  })

  it("does not deduplicate repeated entries", () => {
    expect(parse("https://example.com/a\nhttps://example.com/a")).toEqual([
      "https://example.com/a",
      "https://example.com/a",
    ])
  })
})

describe("serialize", () => {
  it("returns null for an empty array", () => {
    expect(serialize([])).toBeNull()
  })

  it("returns null when every entry is blank", () => {
    expect(serialize(["  ", ""])).toBeNull()
  })

  it("serializes a single URL", () => {
    expect(serialize(["https://example.com/a"])).toBe("https://example.com/a")
  })

  it("joins multiple URLs with newlines in input order", () => {
    expect(serialize(["https://example.com/a", "https://example.com/b"])).toBe(
      "https://example.com/a\nhttps://example.com/b",
    )
  })
})

describe("shouldPropose", () => {
  it("is true for null, undefined, and whitespace-only ledgers", () => {
    expect(shouldPropose(null)).toBe(true)
    expect(shouldPropose(undefined)).toBe(true)
    expect(shouldPropose("   ")).toBe(true)
  })

  it("is false when the ledger has at least one entry", () => {
    expect(shouldPropose("https://example.com/a")).toBe(false)
  })
})

describe("rankCitations", () => {
  it("excludes wikipedia citations", () => {
    const result = rankCitations([makeSource({ url: "https://en.wikipedia.org/wiki/X", domainType: "wikipedia" })])
    expect(result).toEqual([])
  })

  it("excludes aggregate URLs (feed/author/tag/category)", () => {
    const result = rankCitations([
      makeSource({ url: "https://example.com/feed/x" }),
      makeSource({ url: "https://example.com/author/x" }),
      makeSource({ url: "https://example.com/tag/x" }),
      makeSource({ url: "https://example.com/category/x" }),
    ])
    expect(result).toEqual([])
  })

  it("sorts descending by authority weight", () => {
    const web = makeSource({ url: "https://example.com/web", domainType: "web" })
    const official = makeSource({ url: "https://example.gov/official", domainType: "official" })
    const news = makeSource({ url: "https://news.example/article", domainType: "news" })
    expect(rankCitations([web, news, official])).toEqual([official, news, web])
  })

  it("preserves input order for equal-weight citations", () => {
    const first = makeSource({ url: "https://example.com/1", domainType: "news" })
    const second = makeSource({ url: "https://example.com/2", domainType: "news" })
    expect(rankCitations([first, second])).toEqual([first, second])
  })

  it("returns [] when every input is excluded", () => {
    const result = rankCitations([
      makeSource({ url: "https://en.wikipedia.org/wiki/X", domainType: "wikipedia" }),
      makeSource({ url: "https://example.com/feed/x" }),
    ])
    expect(result).toEqual([])
  })
})

describe("selectTopCitations", () => {
  it("defaults to the top 2 after ranking", () => {
    const a = makeSource({ url: "https://example.gov/a", domainType: "official" })
    const b = makeSource({ url: "https://news.example/b", domainType: "news" })
    const c = makeSource({ url: "https://example.com/c", domainType: "web" })
    expect(selectTopCitations([c, b, a])).toEqual([a, b])
  })

  it("respects a custom n", () => {
    const a = makeSource({ url: "https://example.gov/a", domainType: "official" })
    const b = makeSource({ url: "https://news.example/b", domainType: "news" })
    expect(selectTopCitations([a, b], 1)).toEqual([a])
  })

  it("returns fewer than n when the filtered set is smaller", () => {
    const only = makeSource({ url: "https://example.gov/a", domainType: "official" })
    const wiki = makeSource({ url: "https://en.wikipedia.org/wiki/X", domainType: "wikipedia" })
    expect(selectTopCitations([only, wiki])).toEqual([only])
  })

  it("excludes a wikipedia citation even when it would otherwise rank first by weight", () => {
    const wiki = makeSource({ url: "https://en.wikipedia.org/wiki/X", domainType: "wikipedia" })
    const news = makeSource({ url: "https://news.example/b", domainType: "news" })
    expect(selectTopCitations([wiki, news])).toEqual([news])
  })
})

describe("merge", () => {
  it("dedupes existing and new URLs", () => {
    expect(merge("https://example.com/a", ["https://example.com/a", "https://example.com/b"])).toBe(
      "https://example.com/a\nhttps://example.com/b",
    )
  })

  it("preserves existing-first ordering", () => {
    expect(merge("https://example.com/b", ["https://example.com/a"])).toBe(
      "https://example.com/b\nhttps://example.com/a",
    )
  })

  it("returns null when existing is null/undefined and newUrls is empty", () => {
    expect(merge(null, [])).toBeNull()
    expect(merge(undefined, [])).toBeNull()
  })

  it("returns null when every input is blank", () => {
    expect(merge("  ", ["   "])).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import { rankCitations, selectTopCitations } from "./citation-rating"
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

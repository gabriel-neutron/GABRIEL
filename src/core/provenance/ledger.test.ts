import { describe, expect, it } from "vitest"
import { parse } from "./ledger"

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

import { describe, expect, it } from "vitest"
import { merge, parse, serialize, shouldPropose } from "./ledger"

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

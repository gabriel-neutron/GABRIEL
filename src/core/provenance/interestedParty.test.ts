import { describe, expect, it } from "vitest"
import { isInterestedParty } from "./interestedParty"

describe("isInterestedParty", () => {
  it("flags a curated state-media / belligerent-MoD domain", () => {
    expect(isInterestedParty("https://tass.com/some-article")).toBe(true)
    expect(isInterestedParty("https://function.mil.ru/news/page.htm")).toBe(true)
  })

  it("flags the Phase 5 (v1.5) expanded entries", () => {
    expect(isInterestedParty("https://tvzvezda.ru/news/2026")).toBe(true)
    expect(isInterestedParty("https://www.kremlin.ru/events/president")).toBe(true)
    expect(isInterestedParty("https://belta.by/regions")).toBe(true)
  })

  it("does not flag an unrelated domain", () => {
    expect(isInterestedParty("https://bbc.com/news/x")).toBe(false)
    expect(isInterestedParty("https://example.com/a")).toBe(false)
  })

  it("returns false rather than throwing on an unparseable URL", () => {
    expect(isInterestedParty("not a url")).toBe(false)
  })
})

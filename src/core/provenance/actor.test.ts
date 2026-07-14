import { describe, expect, it } from "vitest"
import { deriveActorId } from "./actor"

describe("deriveActorId", () => {
  it("derives the registrable domain, stripping a leading www.", () => {
    expect(deriveActorId("https://www.bellingcat.com/2026/report")).toBe("bellingcat.com")
    expect(deriveActorId("https://bellingcat.com/2026/report")).toBe("bellingcat.com")
  })

  it("treats different pages on the same host as the same actor", () => {
    expect(deriveActorId("https://oryxspioenkop.com/a")).toBe(deriveActorId("https://oryxspioenkop.com/b"))
  })

  it("treats different hosts as different actors, subdomains included", () => {
    expect(deriveActorId("https://a.example/x")).not.toBe(deriveActorId("https://b.example/x"))
    expect(deriveActorId("https://news.example.com/x")).not.toBe(deriveActorId("https://example.com/x"))
  })

  it("returns null rather than throwing on an unparseable URL", () => {
    expect(deriveActorId("not a url")).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import { getDomainTypeFromUrl } from "./domainType"

describe("getDomainTypeFromUrl", () => {
  it("classifies wikipedia", () => {
    expect(getDomainTypeFromUrl("https://en.wikipedia.org/wiki/Test")).toBe("wikipedia")
  })

  it("classifies government and military domains as official", () => {
    expect(getDomainTypeFromUrl("https://army.mil")).toBe("official")
    expect(getDomainTypeFromUrl("https://state.gov")).toBe("official")
    expect(getDomainTypeFromUrl("https://mil.ru")).toBe("official")
  })

  it("classifies country-code government/military domains as official (not web)", () => {
    expect(getDomainTypeFromUrl("https://www.gov.uk/guidance")).toBe("official")
    expect(getDomainTypeFromUrl("https://www.gov.ua/en")).toBe("official")
    expect(getDomainTypeFromUrl("https://www.gouv.fr/page")).toBe("official")
    expect(getDomainTypeFromUrl("https://mod.gov.ua/en")).toBe("official")
  })

  it("does not misclassify a label that merely contains 'gov'/'mil' as official", () => {
    expect(getDomainTypeFromUrl("https://governance.example.com")).toBe("web")
    expect(getDomainTypeFromUrl("https://family.com")).toBe("web")
  })

  it("classifies known OSINT domains", () => {
    expect(getDomainTypeFromUrl("https://www.bellingcat.com/x")).toBe("osint")
    expect(getDomainTypeFromUrl("https://www.oryxspioenkop.com/x")).toBe("osint")
    expect(getDomainTypeFromUrl("https://uawardata.com/x")).toBe("osint")
  })

  it("classifies social platforms", () => {
    expect(getDomainTypeFromUrl("https://vk.com/wall1")).toBe("social")
    expect(getDomainTypeFromUrl("https://telegram.me/somechannel")).toBe("social")
  })

  it("classifies forums", () => {
    expect(getDomainTypeFromUrl("https://reddit.com/r/test")).toBe("forum")
    expect(getDomainTypeFromUrl("https://some.forum.example/thread")).toBe("forum")
  })

  it("does not misclassify a domain whose label merely contains 'forum'/'telegram' as forum/social", () => {
    expect(getDomainTypeFromUrl("https://newsforum.example.com")).toBe("web")
    expect(getDomainTypeFromUrl("https://telegramwatch.example.com")).toBe("web")
  })

  it("classifies known news domains", () => {
    expect(getDomainTypeFromUrl("https://www.bbc.com/news")).toBe("news")
    expect(getDomainTypeFromUrl("https://www.rferl.org/a")).toBe("news")
    expect(getDomainTypeFromUrl("https://meduza.io/news")).toBe("news")
  })

  it("falls back to web for an unrecognized domain", () => {
    expect(getDomainTypeFromUrl("https://example.com/page")).toBe("web")
  })

  it("falls back to web for an unparseable URL rather than throwing", () => {
    expect(getDomainTypeFromUrl("not a url")).toBe("web")
  })
})

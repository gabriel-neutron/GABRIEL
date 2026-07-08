import { describe, expect, it } from "vitest"
import { normalizeForMatch, transliterateCyrillic } from "./transliterate"

describe("transliterateCyrillic", () => {
  it("maps Cyrillic letters to their Latin matching form", () => {
    expect(transliterateCyrillic("Вагнер")).toBe("Vagner")
    expect(transliterateCyrillic("Москва")).toBe("Moskva")
  })

  it("leaves Latin text untouched", () => {
    expect(transliterateCyrillic("Wagner")).toBe("Wagner")
  })
})

describe("normalizeForMatch", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeForMatch("  1st  Guards-Brigade! ")).toBe("1st guards brigade")
  })

  it("applies phonetic folds (w→v, y→i, ck→k) so lookalike spellings share a key", () => {
    expect(normalizeForMatch("Army")).toBe("armi")
    expect(normalizeForMatch("Blackwater")).toBe("blakvater")
  })

  it("strips diacritics", () => {
    expect(normalizeForMatch("Donétsk")).toBe(normalizeForMatch("Donetsk"))
    expect(normalizeForMatch("Kryvyí Rih")).toBe("krivii rih")
  })

  it("folds a Cyrillic name and its German-style Latin spelling to the same key", () => {
    // Вагнер → 'vagner'; Wagner → phonetic w→v → 'vagner'.
    expect(normalizeForMatch("Вагнер")).toBe(normalizeForMatch("Wagner"))
  })

  it("returns an empty string for a name with no alphanumeric content", () => {
    expect(normalizeForMatch("—")).toBe("")
    expect(normalizeForMatch("   ")).toBe("")
  })

  it("is idempotent", () => {
    const once = normalizeForMatch("Вагнер Group")
    expect(normalizeForMatch(once)).toBe(once)
  })
})

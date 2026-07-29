import { describe, expect, it } from "vitest"
import { ENTITY_KINDS, type EntityKind, type Profile } from "./entity"

/** `[A] extends [B]` — tuple-wrapped so the union is compared whole, not distributed. */
type Extends<A, B> = [A] extends [B] ? true : false
type Expect<T extends true> = T

describe("ENTITY_KINDS", () => {
  it("keeps ENTITY_KINDS and the Profile kind union in agreement", () => {
    // Both directions are enforced by `tsc -b`: if a Profile member is added
    // without its kind reaching ENTITY_KINDS (or the reverse), `Expect` receives
    // `false` and this file stops compiling.
    const everyProfileKindIsAnEntityKind: Expect<Extends<Profile["kind"], EntityKind>> = true
    const everyEntityKindIsAProfileKind: Expect<Extends<EntityKind, Profile["kind"]>> = true

    expect(everyProfileKindIsAnEntityKind).toBe(true)
    expect(everyEntityKindIsAProfileKind).toBe(true)
    expect(ENTITY_KINDS).toHaveLength(5)
    expect([...ENTITY_KINDS]).toEqual(["unit", "corporate", "vessel", "person", "equipment_class"])
  })

  it("holds no duplicate kinds", () => {
    expect(new Set(ENTITY_KINDS).size).toBe(ENTITY_KINDS.length)
  })
})

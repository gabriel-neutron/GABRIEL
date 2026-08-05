import { describe, expect, it } from "vitest"
import { ENTITY_KINDS } from "@/core/entity/entity"
import { entityKindLabel } from "@/core/entity/entityKindLabels"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { newEntityForKind } from "./newEntity"

const CONTEXT = { id: "new-id", defaultLayerId: "custom-1" }
const CREATABLE_KINDS = ENTITY_KINDS

describe("entityKindLabel", () => {
  it("names every kind the Profile union declares, distinctly", () => {
    // The whole point of the change: `owned_by` names `person` as its target kind and
    // `fields` names `equipment_class`, and until the menu was driven off ENTITY_KINDS
    // the vocabulary declared endpoints no interface could mint.
    const labels = ENTITY_KINDS.map(entityKindLabel)
    expect(labels.every((label) => label.trim() !== "")).toBe(true)
    expect(new Set(labels).size).toBe(ENTITY_KINDS.length)
  })
})

describe("newEntityForKind", () => {
  it("mints a unit on the supplied layer, hostile by default", () => {
    expect(newEntityForKind("unit", CONTEXT)).toEqual({
      kind: "unit",
      id: "new-id",
      name: "New entity",
      layerId: "custom-1",
      parentId: null,
      affiliation: "Hostile",
      isExactPosition: false,
    })
  })

  it("pins a corporate entity to the fixed industry layer, ignoring the default", () => {
    // CorporateProfile "always sits on the fixed synthetic INDUSTRY_LAYER_ID layer,
    // never an arbitrary one" (entity.ts) — the caller's default layer is not a choice here.
    const org = newEntityForKind("corporate", CONTEXT)
    expect(org.layerId).toBe(INDUSTRY_LAYER_ID)
    expect(org.type).toBe("company")
  })

  it("mints a bare profile with no unit or corporate fields on it", () => {
    // ADR 0010: vessel, person and equipment_class carry the discriminant and nothing
    // else until Slice 5. A default `type` or `affiliation` here would be this function
    // inventing a field set the profile has not been given.
    for (const kind of ["person", "vessel", "equipment_class"] as const) {
      const entity = newEntityForKind(kind, CONTEXT)
      expect(entity.kind).toBe(kind)
      expect(entity.layerId).toBe("custom-1")
      expect(entity.type).toBeUndefined()
      expect(entity.affiliation).toBeUndefined()
      expect(entity.echelon).toBeUndefined()
    }
  })

  it("names each kind distinctly, so five fresh entities are told apart in a picker", () => {
    const names = CREATABLE_KINDS.map((kind) => newEntityForKind(kind, CONTEXT).name)
    expect(new Set(names).size).toBe(CREATABLE_KINDS.length)
  })

  it("never carries a parent: the edge set is the sole authority (ADR 0011)", () => {
    for (const kind of CREATABLE_KINDS) {
      expect(newEntityForKind(kind, CONTEXT).parentId).toBeNull()
    }
  })
})

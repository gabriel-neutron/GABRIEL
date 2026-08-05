import type { EntityKind } from "@/core/entity/entity"
import type { MapEntity } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"

/**
 * A freshly created entity of each kind, in one place.
 *
 * Until this module the creation path minted exactly two kinds: `unit`, from
 * `MainLayout`, and `corporate`, from a separate `EditPage` callback threaded through
 * three files to say only "the other one". Meanwhile the edge vocabulary names
 * `person` as the target of `owned_by`, `equipment_class` as the target of `fields`,
 * and `vessel` as a source of `operated_by` and `insured_by` — five types pointing at
 * three kinds nothing could create, so the split between `owned_by` and
 * `corporate_parent`, which exists to keep a natural person's ownership out of the
 * public dataset, could not be exercised from the interface at all.
 *
 * It lives in `shell/` rather than `core/entity/` on the CONSTRAINTS rule that
 * `core/entity` must not import any one Profile's field set: this function reads
 * `UnitProfile.affiliation` and `CorporateProfile.type` in the same breath, which is
 * exactly the import that rule forbids. `shell/` is where profiles are already composed,
 * and `entityLayer.ts` is its neighbour.
 */

export type NewEntityContext = {
  /** Injected, not minted: this module reads no clock and calls no `crypto`. */
  id: string
  /** Where a new entity goes when its profile does not pin it somewhere fixed. */
  defaultLayerId: string
}

const NEW_NAMES: Record<EntityKind, string> = {
  unit: "New entity",
  corporate: "New organisation",
  vessel: "New vessel",
  person: "New person",
  equipment_class: "New equipment class",
}

/**
 * Pure. `parentId` is always null on every kind: it is derived from the edge set on
 * every load (ADR 0011), so a parent written here would be erased at the next save.
 * The caller commits the real parent as an edge instead.
 *
 * The three bare profiles get the discriminant, a name and a layer, and nothing else.
 * A default `type` or `affiliation` on a person would be this function inventing a
 * field set ADR 0010 deliberately withheld until Slice 5 — and because `Entity` is
 * D1-loose, nothing in the type system would have objected.
 */
export function newEntityForKind(kind: EntityKind, context: NewEntityContext): MapEntity {
  const base = {
    kind,
    id: context.id,
    name: NEW_NAMES[kind],
    layerId: context.defaultLayerId,
    parentId: null,
    isExactPosition: false,
  } satisfies MapEntity

  if (kind === "unit") return { ...base, affiliation: "Hostile" }
  if (kind === "corporate") {
    return {
      ...base,
      layerId: INDUSTRY_LAYER_ID,
      type: "company",
      notes: null,
      osmRelationId: null,
      positionMode: "own",
    }
  }
  return base
}

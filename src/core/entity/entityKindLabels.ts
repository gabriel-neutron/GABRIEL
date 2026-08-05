import type { EntityKind } from "./entity"

/**
 * The `kind` discriminant as prose, for pickers and menus.
 *
 * A `Record<EntityKind, string>` rather than a humanising function: `corporate` reads
 * "Industrial entity" in this project's vocabulary and `unit` reads "Military unit",
 * neither of which is derivable from the identifier — and the exhaustive record is what
 * makes a sixth profile a compile error here rather than a blank button.
 *
 * This is a display name per discriminant, not a Profile's field set, so it does not
 * cross the line `core/entity` draws (CONSTRAINTS): the per-kind field defaults live in
 * `shell/newEntity.ts`, which is allowed to read them.
 */
const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  unit: "Military unit",
  corporate: "Industrial entity",
  vessel: "Vessel",
  person: "Person",
  equipment_class: "Equipment class",
}

export function entityKindLabel(kind: EntityKind): string {
  return ENTITY_KIND_LABELS[kind]
}

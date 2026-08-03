import type { MapEntity } from "@/types/domain.types"
import type { SymbolEchelon } from "@/types/symbol.types"
import type { Relationship } from "@/core/relationship/relationship"
import { withActiveParent } from "@/core/relationship/activeParent"

/**
 * The bodies of `useEntityInspector`'s write handlers, with every React binding replaced by a
 * parameter. The shape is P1b's `projectIO.ts`, extracted out of `useProjectIO.ts` for the same
 * reason and with the same payoff.
 *
 * They stay under `modules/orbat/hooks/` rather than moving to `core/` because they write through
 * store actions, which `core/` may not know about. What they stop being is *React*, which is the
 * point: a `useCallback` cannot be invoked without a renderer, vitest here runs
 * `environment: "node"`, and jsdom and `@testing-library/react` were both ruled against — so
 * `handleParentChange`'s body was reachable by no test at all (Q2B-21). The test that existed
 * could only mirror the composition in its own four lines, and a mirror still passes when the
 * original is deleted. Moving the body here is what lets a test hold the body itself.
 */

/**
 * The store actions these commands write through, seen as the plain functions they are — so a
 * test can hand them recording doubles and observe *which* action was called with *what*, rather
 * than inferring it from the end state of a real store.
 */
export interface EntityInspectorWriters {
  updateEntity: (entityId: string, patch: Partial<MapEntity>) => void
  setRelationships: (next: Relationship[]) => void
}

function detectEchelonFromName(name: string): SymbolEchelon | null {
  const n = name.toLowerCase()
  if (n.includes("division")) return "Division"
  if (n.includes("brigade")) return "Brigade"
  if (n.includes("regiment") || n.includes("régiment")) return "Regiment/group"
  if (n.includes("battalion") || n.includes("bataillon")) return "Battalion/squadron"
  if (n.includes("company") || n.includes("compagnie")) return "Company/battery/troop"
  if (n.includes("platoon") || n.includes("section")) return "Platoon/detachment"
  return null
}

/**
 * Renames the entity, and for a unit whose echelon is still blank, infers one from the new name.
 *
 * The inference deliberately fires only on a BLANK echelon: a rename is not a statement about
 * echelon, so re-detecting over one the analyst already set would let a typo fix silently
 * overwrite their judgement.
 */
export function applyNameChange(
  entity: MapEntity,
  name: string,
  writers: Pick<EntityInspectorWriters, "updateEntity">,
): void {
  const patch: Partial<MapEntity> = { name }
  if (entity.kind === "unit" && (!entity.echelon || entity.echelon === "")) {
    const detected = detectEchelonFromName(name)
    if (detected) {
      patch.echelon = detected
    }
  }
  writers.updateEntity(entity.id, patch)
}

/**
 * Commits the analyst's parent pick, and clears a position that depended on the parent.
 *
 * The parent is written as an EDGE and never as a field: `parentId` is derived from the edge set
 * (ADR 0011), so a direct write would be undone by the next derivation. `withActiveParent`
 * REPLACES the child's hierarchy-bearing edge instead of adding one — a second active edge makes
 * the child contested, `activeParentMap` deliberately leaves a contested child out of
 * `parentById`, and the analyst would watch their pick vanish at the next load (Q2B-15). That
 * writer is also the only route to hierarchy semantics taken here: this module never tests a
 * relationship type of its own (criterion 76).
 *
 * `edgeId` is injected rather than minted here for the same reason `core/` takes it injected —
 * the caller owns the clock and the id source, so this stays reproducible under test.
 */
export function applyParentChange(
  entity: MapEntity,
  relationships: Relationship[],
  parentId: string | null,
  edgeId: string,
  writers: EntityInspectorWriters,
): void {
  writers.setRelationships(withActiveParent(relationships, entity, parentId, edgeId))
  // Separate concern, kept: an entity positioned BY its parent has nowhere left to be.
  if (parentId == null && entity.positionMode === "parent") {
    writers.updateEntity(entity.id, { positionMode: "none" })
  }
}

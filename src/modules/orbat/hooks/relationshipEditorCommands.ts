import type { Relationship, RelationshipDraft } from "@/core/relationship/relationship"
import type { RelationshipViolation } from "@/core/relationship/validate"
import { withAuthoredEdge, withEndDatedEdge, withoutEdge } from "@/core/relationship/authoring"

/**
 * The bodies of the relationship editor's write handlers, with every React binding replaced by a
 * parameter — the shape `entityInspectorCommands.ts` established, and for the same reason: a
 * `useCallback` cannot be invoked without a renderer, and this repo has no React Testing Library,
 * so a handler that stays in the hook is a handler no test can hold.
 *
 * They stay under `modules/orbat/hooks/` rather than in `core/` because they write through a
 * store action, which `core/` may not know about. The rules themselves are all one import away,
 * in `core/relationship/authoring.ts`; nothing here decides what is valid.
 *
 * Each returns the violations that refused the write, empty when it committed. Returning them
 * rather than throwing is what lets the form show the analyst the vocabulary's own words about
 * why an edge was not recorded.
 */

export interface RelationshipEditorWriters {
  setRelationships: (next: Relationship[]) => void
}

/**
 * `edgeId` is injected rather than minted here for the same reason `core/` takes it injected —
 * the caller owns the id source, so this stays reproducible under test.
 */
export function applyAuthorEdge(
  relationships: Relationship[],
  draft: RelationshipDraft,
  edgeId: string,
  entityIds: Set<string>,
  writers: RelationshipEditorWriters,
): RelationshipViolation[] {
  const outcome = withAuthoredEdge(relationships, draft, edgeId, entityIds)
  // A refused edge must not reach the store at all. `setRelationships` re-derives every
  // `parentId` and mints contest events from what it is handed, so committing first and
  // reporting afterwards would put the fault in the ledger that ships with the data.
  if (!outcome.ok) return outcome.violations
  writers.setRelationships(outcome.relationships)
  return []
}

export function applyEndDate(
  relationships: Relationship[],
  edgeId: string,
  endDate: string | null,
  entityIds: Set<string>,
  writers: RelationshipEditorWriters,
): RelationshipViolation[] {
  const outcome = withEndDatedEdge(relationships, edgeId, endDate, entityIds)
  if (!outcome.ok) return outcome.violations
  writers.setRelationships(outcome.relationships)
  return []
}

export function applyDeleteEdge(
  relationships: Relationship[],
  edgeId: string,
  writers: RelationshipEditorWriters,
): void {
  writers.setRelationships(withoutEdge(relationships, edgeId))
}

import type { NamedSet } from "zustand/middleware"
import { acknowledgeIntegrityEvent } from "@/core/integrity/acknowledge"
import type { ProjectActions, ProjectState } from "./useProjectStore"

/**
 * The integrity ledger's one write action, split out of `useProjectStore.ts` so that file stays
 * inside the 300-line cap (`CONSTRAINTS.md:113`) — same shape and same reason as
 * `projectClaimActions.ts` and `projectLayerActions.ts`.
 *
 * It is the only place in Gabriel that writes to an integrity event, and it writes to nothing
 * else: minting stays with `mintOnLoad` and `withContestedParentEvents`, which the store reaches
 * through `commitRelationships`. Acknowledging never mints, never deletes and never resolves —
 * `acknowledge.ts` says why.
 */

type IntegrityActions = Pick<ProjectActions, "acknowledgeIntegrityEvent">

export function createIntegrityActions(
  set: NamedSet<ProjectState & ProjectActions>,
  get: () => ProjectState,
): IntegrityActions {
  return {
    acknowledgeIntegrityEvent(eventId, by, note) {
      // The clock lives here, not in the pure function, which is the same split
      // `commitRelationships` uses for the timestamps it mints.
      const next = acknowledgeIntegrityEvent(get().integrityEvents, eventId, {
        by,
        note,
        at: new Date().toISOString(),
      })
      // Reference equality is how `acknowledge.ts` reports a refusal — a blank acknowledger, an
      // unknown id, or an event somebody already acknowledged. Setting anyway would notify every
      // subscriber that nothing had changed.
      if (next === get().integrityEvents) return
      set({ integrityEvents: next }, false, "acknowledgeIntegrityEvent")
    },
  }
}

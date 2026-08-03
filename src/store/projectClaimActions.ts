import type { NamedSet } from "zustand/middleware"
import { assignCredibility, confirmCredibility, refuteCredibility } from "@/core/provenance/reviewQueue"
import { createRatingEvent } from "@/core/provenance/ratingEvent"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import type { ProjectActions, ProjectState } from "./useProjectStore"

/**
 * The five claim actions, split out of `useProjectStore.ts` so that file stays inside the
 * 300-line cap (`CONSTRAINTS.md:113`) — same shape and same reason as `projectLayerActions.ts`.
 *
 * They travel together because they share one non-obvious coupling: the two review-queue verdicts
 * append a `RatingEvent` to the *peripheral* provenance store, so this file, not the project
 * store, is where the cross-store write lives. `useProvenanceStore` is imported at runtime here;
 * everything taken from `useProjectStore.ts` is a TYPE, so the two files have one runtime edge and
 * it points from the store into this module.
 */

type ClaimActions = Pick<
  ProjectActions,
  | "addClaims"
  | "removeClaim"
  | "confirmClaimCredibility"
  | "refuteClaimCredibility"
  | "applyCredibilityToClaims"
>

export function createClaimActions(
  set: NamedSet<ProjectState & ProjectActions>,
  get: () => ProjectState,
): ClaimActions {
  return {
    addClaims(claims) {
      set((s) => ({ claims: [...s.claims, ...claims] }), false, "addClaims")
    },

    removeClaim(claimId) {
      set((s) => ({ claims: s.claims.filter((c) => c.id !== claimId) }), false, "removeClaim")
    },

    confirmClaimCredibility(claimId) {
      const before = get().claims.find((c) => c.id === claimId)?.credibility ?? null
      set((s) => ({ claims: confirmCredibility(s.claims, claimId) }), false, "confirmClaimCredibility")
      const after = get().claims.find((c) => c.id === claimId)?.credibility ?? null
      if (after === before) return // ineligible — confirmCredibility left it unchanged, nothing to log
      useProvenanceStore.getState().appendRatingEvent(
        createRatingEvent({
          targetType: "claim",
          targetId: claimId,
          kind: "credibility",
          value: String(after),
          assessor: { kind: "analyst" },
        }),
      )
    },

    refuteClaimCredibility(claimId) {
      const claimExists = get().claims.some((c) => c.id === claimId)
      if (!claimExists) return
      set((s) => ({ claims: refuteCredibility(s.claims, claimId) }), false, "refuteClaimCredibility")
      useProvenanceStore.getState().appendRatingEvent(
        createRatingEvent({
          targetType: "claim",
          targetId: claimId,
          kind: "credibility",
          value: "refuted",
          assessor: { kind: "analyst" },
        }),
      )
    },

    applyCredibilityToClaims(claimIds, result) {
      if (result == null) return
      set((s) => {
        const idSet = new Set(claimIds)
        const targeted = s.claims.filter((c) => idSet.has(c.id))
        if (targeted.length === 0) return s
        const stamped = assignCredibility(targeted, result)
        const stampedById = new Map(stamped.map((c) => [c.id, c]))
        return { claims: s.claims.map((c) => stampedById.get(c.id) ?? c) }
      }, false, "applyCredibilityToClaims")
    },
  }
}

import type { Source } from "./source"
import type { Claim } from "./claim"
import type { AdmiraltyCredibility } from "./admiralty"
import type { CredibilityMeta } from "./ratingMeta"

const LOW_CONFIDENCE_THRESHOLD = 0.5
/** Reliability letters worse than this trigger review — `A`..`C` are considered solid enough not to. */
const REVIEW_RELIABILITY_FLOOR = new Set<Source["reliability"]>(["D", "E", "F"])

export type CredibilityAssessmentResult = {
  credibility: AdmiraltyCredibility
  meta: CredibilityMeta
}

/**
 * Stamps `result` onto every claim, skipping any claim a human has already overridden
 * (ADR 0009's re-run-safe write path) so re-assessment can never clobber a human
 * Confirm/override. A `null` result (nothing to assess, or the model call failed) is a
 * no-op — claims are returned unchanged rather than reset to an unrated state. Pure
 * claim-stamping logic — lives in `core/provenance` (not the enrichment module layer)
 * so non-enrichment callers (e.g. a store patching claims after a detached async
 * assessment resolves) can use it without reaching into a feature module.
 */
export function assignCredibility(claims: Claim[], result: CredibilityAssessmentResult | null): Claim[] {
  if (result == null) return claims
  return claims.map((claim) =>
    claim.credibilityMeta?.overridden === true
      ? claim
      : { ...claim, credibility: result.credibility, credibilityMeta: result.meta },
  )
}

/**
 * Phase 4 (v1.5): whether a source/claim pair belongs in the analyst review queue.
 * Flags: low assessor confidence, reliability at `D` or worse, single-cluster
 * corroboration, an interested-party source as sole origin, a contradicted claim
 * (credibility `4`/`5` — `clampCredibility`'s unique signal for that scenario), or a
 * well-corroborated claim eligible for the human Confirm action (credibility `2`,
 * >=2 clusters, dated evidence — `confirmCredibility`'s own eligibility bar) so that
 * action is actually reachable.
 *
 * `overridden` gates only the checks a human override genuinely resolves — low
 * confidence and single-cluster on the claim side, reliability floor and low
 * confidence on the source side. `interestedParty` (a structural fact about the URL)
 * and a contradicted credibility (the model's standing finding, unaffected by
 * `refuteCredibility` which leaves the numeric value unchanged) stay unconditional:
 * an override doesn't resolve either of those.
 */
export function needsReview(args: { source: Source | null; claim: Claim | null }): boolean {
  const { source, claim } = args
  const sourceOverridden = source?.reliabilityMeta?.overridden === true
  const claimOverridden = claim?.credibilityMeta?.overridden === true

  if (source?.interestedParty === true) return true
  if (!sourceOverridden) {
    if (source?.reliability != null && REVIEW_RELIABILITY_FLOOR.has(source.reliability)) return true
    if (source?.reliabilityMeta?.confidence != null && source.reliabilityMeta.confidence < LOW_CONFIDENCE_THRESHOLD) {
      return true
    }
  }

  if (claim?.credibility === 4 || claim?.credibility === 5) return true
  if (!claimOverridden) {
    if (claim?.credibilityMeta?.confidence != null && claim.credibilityMeta.confidence < LOW_CONFIDENCE_THRESHOLD) {
      return true
    }
    const clusters = claim?.credibilityMeta?.corroborationClusters
    if (clusters != null && clusters <= 1) return true
    if (claim?.credibility === 2 && (clusters ?? 0) >= 2 && (claim?.credibilityMeta?.dates?.length ?? 0) > 0) {
      return true
    }
  }

  return false
}

/**
 * ADR 0009: the only path to credibility `1`. Available only from the review queue,
 * and only when the claim has >=2 distinct corroboration clusters with at least one
 * dated citation — otherwise this is a no-op, leaving the claim at its machine-capped
 * value rather than silently promoting it.
 */
export function confirmCredibility(claims: Claim[], claimId: string): Claim[] {
  return claims.map((claim) => {
    if (claim.id !== claimId) return claim
    const meta = claim.credibilityMeta
    const eligible = (meta?.corroborationClusters ?? 0) >= 2 && (meta?.dates?.length ?? 0) > 0
    if (!eligible) return claim
    return {
      ...claim,
      credibility: 1,
      credibilityMeta: {
        confidence: meta?.confidence ?? null,
        rationale: meta?.rationale ?? null,
        assessor: { kind: "analyst" },
        updatedAt: new Date().toISOString(),
        overridden: true,
        evidenceRefs: meta?.evidenceRefs ?? [],
        corroborationClusters: meta?.corroborationClusters ?? 0,
        statedAttribution: meta?.statedAttribution ?? null,
        dates: meta?.dates ?? [],
      },
    }
  })
}

/**
 * Phase 6 (v2, exploratory): the negative counterpart to `confirmCredibility` — an
 * analyst explicitly disputing a claim, rather than confirming it. Marks the claim
 * `overridden` (so a future re-assessment skips it) without changing its numeric
 * credibility; STANAG has no "worse than the machine cap" grade, so the disagreement
 * is recorded for the Actor track record (`actorPosterior.ts`) rather than the claim
 * itself. A no-op for a claim id that doesn't match.
 */
export function refuteCredibility(claims: Claim[], claimId: string): Claim[] {
  return claims.map((claim) => {
    if (claim.id !== claimId) return claim
    const meta = claim.credibilityMeta
    return {
      ...claim,
      credibilityMeta: {
        confidence: meta?.confidence ?? null,
        rationale: meta?.rationale ?? null,
        assessor: { kind: "analyst" },
        updatedAt: new Date().toISOString(),
        overridden: true,
        evidenceRefs: meta?.evidenceRefs ?? [],
        corroborationClusters: meta?.corroborationClusters ?? 0,
        statedAttribution: meta?.statedAttribution ?? null,
        dates: meta?.dates ?? [],
      },
    }
  })
}

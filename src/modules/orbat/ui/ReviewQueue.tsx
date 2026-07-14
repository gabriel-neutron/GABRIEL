import { useMemo } from "react"
import { Button } from "@/ui/button"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { needsReview } from "@/core/provenance/reviewQueue"
import { selectEntity } from "@/core/map/selection"

type Props = {
  readOnly?: boolean
}

/**
 * Phase 4 (v1.5): the analyst review queue — every flagged source/claim, with its
 * cluster/date/attribution evidence, and the Confirm affordance (the only path to
 * credibility `1`, ADR 0009). Project-wide, not per-entity, since a flagged rating on
 * an unselected entity still needs surfacing.
 */
export function ReviewQueue({ readOnly = false }: Props) {
  const claims = useProjectStore((s) => s.claims)
  const entities = useProjectStore((s) => s.entities)
  const sources = useProvenanceStore((s) => s.sources)

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities])

  const flagged = useMemo(
    () =>
      claims
        .map((claim) => ({ claim, source: sourceById.get(claim.sourceId) ?? null }))
        .filter(({ claim, source }) => needsReview({ source, claim })),
    [claims, sourceById],
  )

  return (
    <div className="flex min-w-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Review</h2>
        <p className="text-xs text-muted-foreground">
          Ratings flagged for analyst attention — low confidence, weak reliability, single-origin corroboration, or a contradiction.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 p-4">
        {flagged.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing flagged right now.</p>
        )}
        {flagged.map(({ claim, source }) => {
          const entity = entityById.get(claim.entityId)
          const meta = claim.credibilityMeta
          const clusters = meta?.corroborationClusters ?? 0
          const dates = meta?.dates?.length ?? 0
          const eligibleForConfirm = claim.credibility === 2 && clusters >= 2 && dates > 0
          return (
            <div key={claim.id} className="space-y-1 rounded-md border p-2 text-xs">
              <button
                type="button"
                className="block w-full truncate text-left font-medium hover:underline"
                onClick={() => selectEntity(claim.entityId)}
                title="Select this entity"
              >
                {entity?.name ?? claim.entityId}
              </button>
              <div className="truncate text-muted-foreground" title={source?.url}>
                {source?.url ?? "(source unavailable)"}
              </div>
              <div className="text-muted-foreground">
                Reliability {source?.reliability ?? "—"} · Credibility {claim.credibility ?? "—"}
                {claim.credibility === 4 || claim.credibility === 5 ? " (contradicted)" : ""}
              </div>
              {meta && (
                <div className="text-muted-foreground">
                  {clusters <= 1 ? "single-origin" : `${clusters} clusters`} · {dates > 0 ? `${dates} dated` : "no dates"} ·{" "}
                  {meta.statedAttribution ?? "no stated attribution"}
                </div>
              )}
              {!readOnly && claim.credibilityMeta?.overridden !== true && (
                <div className="flex gap-1">
                  {claim.credibility === 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={!eligibleForConfirm}
                      title={
                        eligibleForConfirm
                          ? "Promote to Confirmed (1) — human review action"
                          : "Needs >=2 corroboration clusters with dated evidence"
                      }
                      onClick={() => useProjectStore.getState().confirmClaimCredibility(claim.id)}
                    >
                      Confirm
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    title="Refute — records analyst disagreement against this claim's source Actor (Phase 6)"
                    onClick={() => useProjectStore.getState().refuteClaimCredibility(claim.id)}
                  >
                    Refute
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

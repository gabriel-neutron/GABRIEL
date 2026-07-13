import { Button } from "@/ui/button"
import type { MatchCandidate } from "@/core/identity/matchCandidates"

export type DuplicateCandidate = {
  id: string
  name: string
  score: number
  reason: MatchCandidate["reason"]
}

/**
 * The minimal E3 surface (ADR 0006): lists the selected entity's possible duplicates
 * (from `matchesForEntity`) and lets the analyst merge one in. "Propose" is this list;
 * "confirm" is the `window.confirm` guard; "merge" is `onMerge`, wired to the store's
 * `mergeEntities`. Renders nothing when there are no candidates.
 */
export function DuplicateMatchesSection({
  candidates,
  onMerge,
}: {
  candidates: DuplicateCandidate[]
  onMerge: (otherId: string) => void
}) {
  if (candidates.length === 0) return null

  function handleMerge(candidate: DuplicateCandidate): void {
    if (window.confirm(`Merge "${candidate.name}" into this entity? Its name is kept as an alias and its sources, geometries, and children move here.`)) {
      onMerge(candidate.id)
    }
  }

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">Possible duplicates</div>
      <ul className="mt-1 space-y-1">
        {candidates.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate" title={c.name}>{c.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {c.reason === "exact-normalized" ? "exact" : `${Math.round(c.score * 100)}%`}
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={() => handleMerge(c)}>
                Merge
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

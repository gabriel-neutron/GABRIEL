import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OsmElementCandidate } from "@/components/inspector/useFindOsmAtPoint"
import { useFindOsmAtPoint } from "@/components/inspector/useFindOsmAtPoint"

function getLanduseTypeLabel(tags: Record<string, string>): string | null {
  const keys = ["landuse", "boundary", "military", "amenity", "building", "place"]
  for (const key of keys) {
    const v = tags[key]
    if (v && typeof v === "string") return v
  }
  return null
}

function candidateLabel(el: OsmElementCandidate): string {
  const name = el.tags?.name
  if (name && typeof name === "string") return name
  return `${el.type} ${el.id}`
}

/** Props for the presentational dialog (used in app via main component, and in Storybook for all states). */
export type FindOsmAtPointDialogContentProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  candidates: OsmElementCandidate[]
  onSelectRelation: (relationId: number) => void
}

/** Presentational dialog: shows loading / error / empty / list. No fetch logic. */
export function FindOsmAtPointDialogContent({
  open,
  onClose,
  loading,
  error,
  candidates,
  onSelectRelation,
}: FindOsmAtPointDialogContentProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="find-relations-dialog-title"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle id="find-relations-dialog-title">
            OSM at point (intersection + 100 m)
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Searching intersection and nearby (100 m)…
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No OSM elements found.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {candidates.map((el) => {
                const label = candidateLabel(el)
                const landuseType = getLanduseTypeLabel(el.tags ?? {})
                return (
                  <li
                    key={`${el.type}/${el.id}`}
                    role="button"
                    tabIndex={0}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={() => onSelectRelation(el.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelectRelation(el.id)
                      }
                    }}
                  >
                    <span
                      className="inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground"
                      aria-label={`Type: ${el.type}`}
                    >
                      {el.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium" title={label}>
                      {label}
                    </span>
                    {landuseType && (
                      <span className="inline-flex shrink-0 items-center rounded-md border bg-secondary/50 px-2 py-0.5 text-xs text-secondary-foreground">
                        {landuseType}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Main component: opens when user clicks "Find OSM at point", fetches at (lat, lng), shows loading then list. Use in app. */
export function FindOsmAtPointDialog({
  open,
  onClose,
  lat,
  lng,
  onSelectRelation,
}: {
  open: boolean
  onClose: () => void
  lat: number
  lng: number
  onSelectRelation: (relationId: number) => void
}) {
  const { loading, error, candidates } = useFindOsmAtPoint(open, lat, lng)
  return (
    <FindOsmAtPointDialogContent
      open={open}
      onClose={onClose}
      loading={loading}
      error={error}
      candidates={candidates}
      onSelectRelation={onSelectRelation}
    />
  )
}

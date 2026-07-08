import type { KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { OsmElementCandidate } from "@/modules/osm/hooks/useFindOsmAtPoint"
import { useFindOsmAtPoint } from "@/modules/osm/hooks/useFindOsmAtPoint"

function getLanduseTypeLabel(tags: Record<string, string>): string | null {
  const keys = ["landuse", "boundary", "military", "amenity", "building", "place"]
  for (const key of keys) {
    const v = tags[key]
    if (v && typeof v === "string") return v
  }
  return null
}

function candidateLabel(el: OsmElementCandidate): string {
  return typeof el.tags?.name === "string" ? el.tags.name : `${el.type} ${el.id}`
}

export type FindOsmAtPointDialogContentProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  candidates: OsmElementCandidate[]
  onSelectRelation: (relationId: number) => void
}

export function FindOsmAtPointDialogContent({
  open,
  onClose,
  loading,
  error,
  candidates,
  onSelectRelation,
}: FindOsmAtPointDialogContentProps) {
  function handleCandidateKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    relationId: number,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onSelectRelation(relationId)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="z-[10000] max-w-md" showCloseButton>
        <DialogHeader className="text-left">
          <DialogTitle id="find-relations-dialog-title" className="text-base font-semibold">
            OSM at point (intersection + 100 m)
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Searching intersection and nearby (100 m)…
            </p>
          ) : error ? (
            <div
              role="alert"
              className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2"
            >
              <p className="text-sm font-medium text-destructive">Unable to search OSM elements</p>
              <p className="text-xs text-destructive/90">{error}</p>
              <p className="text-xs text-muted-foreground">Try again or select another point.</p>
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No OSM elements found.</p>
          ) : (
            <ul className="m-0 flex max-h-[50vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
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
                    onKeyDown={(event) => handleCandidateKeyDown(event, el.id)}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

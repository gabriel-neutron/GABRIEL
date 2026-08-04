import { useCallback, useMemo, useState } from "react"
import { Input } from "@/ui/input"
import { Separator } from "@/ui/separator"
import { orderIntegrityFeed } from "@/core/integrity/integrityFeed"
import { describeUnplacedByContest } from "@/core/map/unplacedNotice"
import { useEntityPositions } from "@/hooks/useEntityPositions"
import { useProjectStore } from "@/store/useProjectStore"
import { IntegrityEventCard } from "./IntegrityEventCard"

type Props = {
  readOnly?: boolean
}

/**
 * The reader for the integrity ledger. Until this panel, Gabriel recorded every hierarchy
 * problem it found into a table that shipped in the published GeoPackage and rendered nowhere:
 * a publishable audit trail with no reader.
 *
 * It reports two things, and they are the same thing seen from two sides — what Gabriel
 * declined to guess at, and the consequence of not guessing:
 *
 * - the ledger itself, one card per event; and
 * - the entities that are consequently absent from the map. A contested child gets no derived
 *   parent and therefore no inherited position (ADR 0011), so the map is silently short of
 *   them. Stating the absence is the honest rendering; drawing an invented midpoint or
 *   electing a winner is the thing ADR 0011 exists to forbid.
 *
 * It is a fixed core panel rather than a module contribution because integrity events are
 * minted by the load and edit paths in `core/`, not by any one module (ADR 0007).
 */
export function IntegrityPanel({ readOnly = false }: Props) {
  const entities = useProjectStore((s) => s.entities)
  const integrityEvents = useProjectStore((s) => s.integrityEvents)
  const acknowledge = useProjectStore((s) => s.acknowledgeIntegrityEvent)
  const { unplacedByContest } = useEntityPositions()

  // Panel-level rather than per-card: an analyst acknowledging four events should say who
  // they are once, and one field is also one place for the reader to see the attribution
  // that is about to be written.
  const [analyst, setAnalyst] = useState("")

  const feed = useMemo(() => orderIntegrityFeed(integrityEvents), [integrityEvents])
  const outstanding = useMemo(() => feed.filter((e) => e.acknowledgedAt == null).length, [feed])
  const notice = useMemo(() => describeUnplacedByContest(unplacedByContest, entities), [unplacedByContest, entities])

  const handleAcknowledge = useCallback(
    (eventId: string, note: string) => acknowledge(eventId, analyst, note),
    [acknowledge, analyst],
  )

  return (
    <div className="flex min-w-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Integrity</h2>
        <p className="text-xs text-muted-foreground">
          What Gabriel found in this project and declined to guess at. Every record here ships with the data.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {notice != null && (
          <div className="space-y-1 rounded-md border border-dashed p-2 text-xs">
            <p>{notice.sentence}</p>
            <p className="text-muted-foreground">{notice.names.join(", ")}</p>
          </div>
        )}

        {feed.length === 0 ? (
          // Not "this project is sound": the ledger holds what Gabriel NOTICED, and its
          // emptiness is a statement about the tool's checks, not about the data.
          <p className="text-xs text-muted-foreground">
            Nothing recorded. Gabriel has not found a hierarchy problem in this project.
          </p>
        ) : (
          <>
            {!readOnly && outstanding > 0 && (
              <div className="space-y-1">
                <Input
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  placeholder="Who are you?"
                  className="h-7 text-xs"
                  aria-label="Acknowledging as"
                />
                <p className="text-[11px] text-muted-foreground">
                  Free text, saved with the record. Marking an event read does not resolve it — the record stays exactly as it was made.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {String(outstanding) + " unread of " + String(feed.length) + " recorded"}
            </p>
            <Separator />

            {feed.map((event) => (
              <IntegrityEventCard
                key={event.id}
                event={event}
                readOnly={readOnly}
                analyst={analyst}
                onAcknowledge={handleAcknowledge}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

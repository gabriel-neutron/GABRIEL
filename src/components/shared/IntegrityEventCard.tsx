import { useState } from "react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { INTEGRITY_KIND_LABELS, summariseDetail } from "@/core/integrity/integrityFeed"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"

type Props = {
  event: IntegrityEvent
  readOnly: boolean
  /** Who the panel is acknowledging as. Blank disables the affordance rather than hiding it,
   *  so the reason it is unavailable is visible. */
  analyst: string
  onAcknowledge: (eventId: string, note: string) => void
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  // The decoder accepts any non-empty `createdAt` rather than checking ISO shape, so an
  // unusual timestamp reaches here intact and is shown as recorded instead of as "Invalid Date".
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

/**
 * One row of the integrity ledger. The `summary` is the publishable sentence and leads; the
 * `detail` payload is IDs and is folded away behind a toggle, because it is what an analyst
 * needs to go find the records, not what they need to understand what happened.
 */
export function IntegrityEventCard({ event, readOnly, analyst, onAcknowledge }: Props) {
  const [showDetail, setShowDetail] = useState(false)
  const [note, setNote] = useState("")
  const detailRows = summariseDetail(event.detail)
  const acknowledged = event.acknowledgedAt != null

  return (
    <div className={"space-y-2 rounded-md border p-2 text-xs " + (acknowledged ? "opacity-60" : "")}>
      <div className="flex items-start justify-between gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{INTEGRITY_KIND_LABELS[event.kind]}</span>
        <span className="shrink-0 text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
      </div>

      <p className="leading-snug">{event.summary}</p>

      {detailRows.length > 0 && (
        <div>
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-2"
            onClick={() => setShowDetail((prev) => !prev)}
          >
            {showDetail ? "Hide record" : "Show record"}
          </button>
          {showDetail && (
            <dl className="mt-1 space-y-0.5">
              {detailRows.map((row) => (
                <div key={row.key} className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">{row.key}</dt>
                  <dd className="min-w-0 break-all font-mono">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {acknowledged && (
        <p className="text-muted-foreground">
          {"Read by " + (event.acknowledgedBy ?? "someone") + " on " + formatTimestamp(event.acknowledgedAt ?? "")}
          {event.acknowledgedNote != null && " — " + event.acknowledgedNote}
        </p>
      )}

      {!acknowledged && !readOnly && (
        <div className="flex items-center gap-1">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="h-7 text-xs"
            aria-label={"Note on: " + event.summary}
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={analyst.trim().length === 0}
            title={analyst.trim().length === 0 ? "Enter who you are, above, first" : "Record that you have read this"}
            onClick={() => onAcknowledge(event.id, note)}
          >
            Mark read
          </Button>
        </div>
      )}
    </div>
  )
}

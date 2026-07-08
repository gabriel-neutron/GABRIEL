import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/ui/button"
import type { DrawnGeometry } from "@/types/domain.types"
import { RELIABILITY_RATINGS, type AdmiraltyReliability } from "@/core/provenance/admiralty"

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function geometryLabel(g: DrawnGeometry): string {
  if (g.type === "point") return `Point (${g.lat.toFixed(4)}, ${g.lng.toFixed(4)})`
  if (g.type === "line") return `Line (${g.positions.length} vertices)`
  if (g.type === "polygon") return `Polygon (${g.rings[0]?.length ?? 0} vertices)`
  return "Geometry"
}

export function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  )
}

export function SourcesList({
  sources,
  readOnly,
  onRemove,
  reliabilities,
  onRate,
}: {
  sources: string[]
  readOnly: boolean
  onRemove?: (index: number) => void
  /** ADMIRALTY reliability rating (STANAG 2511) per `sources[index]`, 1:1 (ADR 0006, E2.9). */
  reliabilities?: (AdmiraltyReliability | null)[]
  onRate?: (index: number, reliability: AdmiraltyReliability | null) => void
}) {
  if (sources.length === 0) return null

  const listClass = readOnly ? "mt-1 space-y-1 text-sm" : "mb-2 space-y-1 text-sm"
  const linkClass = readOnly
    ? "min-w-0 flex-1 truncate text-blue-600 hover:underline"
    : "block truncate text-blue-600 hover:underline"
  const textClass = readOnly
    ? "min-w-0 flex-1 whitespace-pre-wrap break-words"
    : "block whitespace-pre-wrap break-words"

  return (
    <ul className={listClass}>
      {sources.map((src, index) => (
        <li key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {isUrl(src) ? (
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                title={src}
                className={linkClass}
              >
                {src}
              </a>
            ) : (
              <span className={textClass}>
                {src}
              </span>
            )}
          </div>
          {readOnly && reliabilities?.[index] != null && (
            <span
              title="ADMIRALTY reliability rating"
              className="h-7 shrink-0 rounded border bg-muted px-1.5 text-xs font-medium leading-7"
            >
              {reliabilities[index]}
            </span>
          )}
          {!readOnly && onRate != null && (
            <select
              value={reliabilities?.[index] ?? ""}
              onChange={(e) => onRate(index, (e.target.value || null) as AdmiraltyReliability | null)}
              aria-label="Source reliability (ADMIRALTY)"
              title="ADMIRALTY reliability rating"
              className="h-7 shrink-0 rounded border bg-background px-1 text-xs"
            >
              <option value="">—</option>
              {RELIABILITY_RATINGS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {!readOnly && onRemove != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0"
              onClick={() => onRemove(index)}
              aria-label="Remove source"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

const DEFAULT_EMPTY_EDIT_MESSAGE =
  "No geometries linked. Draw on the map and link a geometry to add one."

export function LinkedGeometriesList({
  linkedGeometries,
  onDeleteGeometry,
  emptyEditMessage = DEFAULT_EMPTY_EDIT_MESSAGE,
}: {
  linkedGeometries: DrawnGeometry[]
  onDeleteGeometry?: (id: string) => void
  emptyEditMessage?: string
}) {
  if (linkedGeometries.length === 0) {
    if (onDeleteGeometry) {
      return (
        <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
          {emptyEditMessage}
        </div>
      )
    }
    return <div className="text-muted-foreground">None</div>
  }

  if (onDeleteGeometry) {
    return (
      <ul className="space-y-1">
        {linkedGeometries.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate">{geometryLabel(g)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-destructive hover:text-destructive"
              onClick={() => onDeleteGeometry(g.id)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="mt-1 space-y-1">
      {linkedGeometries.map((g) => (
        <li key={g.id} className="truncate rounded border bg-muted/30 px-2 py-1 text-xs">
          {geometryLabel(g)}
        </li>
      ))}
    </ul>
  )
}

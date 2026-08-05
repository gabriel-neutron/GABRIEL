import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import {
  ACTIVE_ROW_ID_PREFIX,
  hasLocalRows,
  type DropdownPos,
  type ResultSection,
  type RowAccent,
  type SearchResult,
} from "./searchResultSections"

type Props = {
  pos: DropdownPos
  query: string
  sections: ResultSection[]
  activeIndex: number
  loading: boolean
  error: string | null
  dropdownRef: React.RefObject<HTMLDivElement | null>
  onSelect: (result: SearchResult) => void
  onHover: (index: number) => void
}

type RowProps = {
  title: string
  detail: string
  accent: RowAccent
  active: boolean
  id: string
  onSelect: () => void
  onHover: () => void
}

function ResultRow({ title, detail, accent, active, id, onSelect, onHover }: RowProps) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Arrow keys can move the highlight past the fold of a `max-h-72` list, and a highlight the
    // analyst cannot see is worse than none: they would be selecting a row off-screen.
    if (active) ref.current?.scrollIntoView({ block: "nearest" })
  }, [active])

  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none",
        accent === "entity" && "border-l-2 border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10",
        accent === "coordinates" && "border-l-2 border-l-sky-500 bg-sky-500/5 hover:bg-sky-500/10",
        accent === "osm" && "border-l-2 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10",
        active && "bg-accent ring-1 ring-inset ring-ring",
      )}
      onMouseMove={onHover}
      onClick={onSelect}
    >
      <span className="line-clamp-1 font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
    </button>
  )
}

function GroupHeading({ label }: { label: string }) {
  return (
    <div className="bg-muted/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  )
}

export function UnifiedSearchDropdown({
  pos,
  query,
  sections,
  activeIndex,
  loading,
  error,
  dropdownRef,
  onSelect,
  onHover,
}: Props) {
  const local = hasLocalRows(sections)
  const hasNominatim = sections.some((s) => s.key === "nominatim")
  const hasAnyRow = sections.some((s) => s.rows.length > 0)

  return createPortal(
    <div
      ref={dropdownRef}
      id="unified-search-listbox"
      role="listbox"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
      className="z-[9999] max-h-72 overflow-auto rounded-md border bg-background shadow-md"
      // Keeping focus on the input is what keeps Escape, the arrow keys and Enter working while
      // the pointer is over the list — and it is why `onBlur` closing the dropdown is safe: a
      // blur now means focus genuinely left the search, not that a row was clicked.
      onMouseDown={(e) => e.preventDefault()}
    >
      {!hasAnyRow && !loading && query.trim() && (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          No results — press Enter to search online
        </p>
      )}

      {sections.map((section) => (
        <div key={section.key} role="group" aria-label={section.label}>
          {section.key === "nominatim" && local && <div className="mx-3 my-1 border-t border-border" />}
          <GroupHeading label={section.label} />
          {section.rows.map((row, i) => (
            <ResultRow
              key={row.key}
              id={ACTIVE_ROW_ID_PREFIX + String(section.startIndex + i)}
              title={row.title}
              detail={row.detail}
              accent={row.accent}
              active={section.startIndex + i === activeIndex}
              onSelect={() => onSelect(row.result)}
              onHover={() => onHover(section.startIndex + i)}
            />
          ))}
        </div>
      ))}

      {loading && (
        <p className={cn("px-3 py-2 text-xs text-muted-foreground", hasAnyRow && "border-t")}>
          {hasAnyRow ? "Loading online results…" : "Searching…"}
        </p>
      )}

      {error && <p className="border-t px-3 py-2 text-sm text-destructive">{error}</p>}

      {local && !hasNominatim && !loading && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Enter opens the highlighted result — use the button to search online places
        </p>
      )}
    </div>,
    document.body,
  )
}

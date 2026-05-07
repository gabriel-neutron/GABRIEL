import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ECHELON_OPTIONS } from "@/types/symbol.types"

export interface ParentOption {
  id: string
  name: string
  echelon?: string
  kind?: "entity" | "organisation"
}

interface FilterableSelectProps {
  options: ParentOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export function FilterableSelect({
  options,
  value,
  onValueChange,
  placeholder = "No parent",
  className,
}: FilterableSelectProps) {
  const [selectedEchelon, setSelectedEchelon] = React.useState<string | null>(null)
  const [selectedKind, setSelectedKind] = React.useState<"entity" | "organisation" | null>(null)
  const echelonOrder = React.useMemo(
    () => ECHELON_OPTIONS.map((option) => option.value),
    [],
  )

  const hasMultipleKinds = React.useMemo(
    () => options.some((o) => o.kind === "entity") && options.some((o) => o.kind === "organisation"),
    [options],
  )

  const availableEchelons = React.useMemo(() => {
    const present = Array.from(
      new Set(
      options
        .map((o) => o.echelon)
        .filter((echelon): echelon is string => echelon != null && echelon !== ""),
      ),
    )
    const orderMap = new Map<string, number>(
      echelonOrder.map((value, index) => [value, index] as const),
    )

    return present.sort((a, b) => {
      const indexA = orderMap.get(a)
      const indexB = orderMap.get(b)

      if (indexA != null && indexB != null) {
        return indexA - indexB
      }

      if (indexA != null) return -1
      if (indexB != null) return 1

      return a.localeCompare(b, undefined, { sensitivity: "base" })
    })
  }, [options, echelonOrder])

  const filteredOptions = React.useMemo(() => {
    let filtered = [...options]
    if (selectedKind != null) filtered = filtered.filter((o) => o.kind === selectedKind)
    if (selectedEchelon != null) filtered = filtered.filter((opt) => opt.echelon === selectedEchelon)
    return filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [options, selectedEchelon, selectedKind])

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="!max-h-80"
        position="popper"
        side="bottom"
        align="start"
        sideOffset={4}
      >
        {hasMultipleKinds ? (
          <div className="-mx-1 mb-1 border-b px-1 pb-2 pt-1">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <div className="text-[11px] font-medium text-muted-foreground">Filter by type</div>
              {selectedKind ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedKind(null)
                  }}
                  className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1 px-1">
              {(["entity", "organisation"] as const).map((kind) => {
                const isActive = selectedKind === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedKind((prev) => (prev === kind ? null : kind))
                    }}
                    className={cn(
                      "h-6 rounded-full border px-2 text-[11px] leading-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-foreground",
                    )}
                    aria-pressed={isActive}
                  >
                    {kind === "entity" ? "Military" : "Industry"}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {availableEchelons.length > 0 ? (
          <div className="-mx-1 mb-1 border-b px-1 pb-2 pt-1">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <div className="text-[11px] font-medium text-muted-foreground">Filter by echelon</div>
              {selectedEchelon ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedEchelon(null)
                  }}
                  className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1 px-1">
              {availableEchelons.map((echelon) => {
                const isActive = selectedEchelon === echelon
                return (
                  <button
                    key={echelon}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedEchelon((prev) => (prev === echelon ? null : echelon))
                    }}
                    className={cn(
                      "h-6 rounded-full border px-2 text-[11px] leading-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-background text-foreground",
                    )}
                    aria-pressed={isActive}
                  >
                    {echelon}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <SelectItem value="__none__">No parent</SelectItem>
        <SelectSeparator />
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => {
            const echelonLabel = opt.echelon ? ` (${opt.echelon})` : ""
            return (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
                {echelonLabel}
              </SelectItem>
            )
          })
        ) : (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units match
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

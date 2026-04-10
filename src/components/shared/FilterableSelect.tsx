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
  const [selectedEchelon, setSelectedEchelon] = React.useState<string | null>(
    null,
  )

  const availableEchelons = React.useMemo(() => {
    const present = new Set(
      options
        .map((o) => o.echelon)
        .filter((echelon): echelon is string => echelon != null && echelon !== ""),
    )

    // NATO “size” order (largest to smallest). Keep only values that exist in options.
    // Falls back to the shared echelon list for labels/compatibility.
    const natoSizeOrder: string[] = [
      "Region/Theater",
      "Army Group/front",
      "Army",
      "Corps/MEF",
      "Division",
      "Brigade",
      "Regiment/group",
      "Battalion/squadron",
      "Company/battery/troop",
      "Platoon/detachment",
      "Section",
      "Squad",
      "Team/Crew",
      "Command",
    ]

    const known = new Set<string>(ECHELON_OPTIONS.map((o) => o.value))
    const orderedKnown = natoSizeOrder.filter((v) => known.has(v))
    const extras = [...present].filter((v) => !orderedKnown.includes(v)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )

    return [...orderedKnown, ...extras].filter((v) => present.has(v))
  }, [options])

  const filteredOptions = React.useMemo(() => {
    const sorted = [...options].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    return sorted.filter((opt) => {
      if (selectedEchelon == null) return true
      return opt.echelon === selectedEchelon
    })
  }, [options, selectedEchelon])

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
        {availableEchelons.length > 0 ? (
          <div className="-mx-1 mb-1 border-b px-1 pb-2 pt-1">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <div className="text-[11px] font-medium text-muted-foreground">Filter by echelon</div>
              {selectedEchelon != null ? (
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

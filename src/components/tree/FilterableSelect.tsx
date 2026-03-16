import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

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
  const [activeEchelons] = React.useState<Set<string>>(
    () => new Set(),
  )

  const filteredOptions = React.useMemo(() => {
    const sorted = [...options].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    return sorted.filter((opt) => {
      const matchEchelon =
        activeEchelons.size === 0 || (opt.echelon != null && activeEchelons.has(opt.echelon))
      return matchEchelon
    })
  }, [options, activeEchelons])

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Cap total height; sticky header pins search+filters while items scroll beneath */}
      <SelectContent className="!max-h-80">
        {/* No parent option */}
        <SelectItem value="__none__">No parent</SelectItem>

        {/* Filtered options */}
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

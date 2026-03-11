import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  const [searchQuery, setSearchQuery] = React.useState("")
  const [activeEchelons, setActiveEchelons] = React.useState<Set<string>>(
    () => new Set(),
  )

  const echelonValues = React.useMemo(() => {
    const s = new Set<string>()
    for (const opt of options) {
      if (opt.echelon) s.add(opt.echelon)
    }
    return Array.from(s).sort()
  }, [options])

  const filteredOptions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return options.filter((opt) => {
      const matchSearch = q === "" || opt.name.toLowerCase().includes(q)
      const matchEchelon =
        activeEchelons.size === 0 || (opt.echelon != null && activeEchelons.has(opt.echelon))
      return matchSearch && matchEchelon
    })
  }, [options, searchQuery, activeEchelons])

  function toggleEchelon(echelon: string) {
    setActiveEchelons((prev) => {
      const next = new Set(prev)
      if (next.has(echelon)) {
        next.delete(echelon)
      } else {
        next.add(echelon)
      }
      return next
    })
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Cap total height; sticky header pins search+filters while items scroll beneath */}
      <SelectContent className="!max-h-80">
        {/* Sticky header: always visible */}
        <div className="sticky top-0 z-10 bg-popover px-2 pt-2">
          <Input
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 text-xs"
          />
          {echelonValues.length > 0 && (
            <div className="flex flex-wrap gap-1 py-1.5">
              {echelonValues.map((echelon) => {
                const isActive = activeEchelons.has(echelon)
                return (
                  <Button
                    key={echelon}
                    type="button"
                    size="xs"
                    variant={isActive ? "default" : "outline"}
                    className="h-5 px-1.5 text-[10px]"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleEchelon(echelon)
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    {echelon}
                  </Button>
                )
              })}
            </div>
          )}
          <div className="bg-border mb-1 h-px" />
        </div>

        {/* No parent option */}
        <SelectItem value="__none__">No parent</SelectItem>

        {/* Filtered options */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.name}
            </SelectItem>
          ))
        ) : (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No units match
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

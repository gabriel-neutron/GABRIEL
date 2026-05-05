import { createRoot } from "react-dom/client"
import type { ComponentType } from "react"
import { useEffect, useRef } from "react"
import L from "leaflet"
import { useMap } from "react-leaflet"
import { Hand, MapPin, Pentagon } from "lucide-react"

import { cn } from "@/lib/utils"

type MapTool = "pan" | "point" | "line" | "polygon"

type Props = {
  mapTool: MapTool
  onMapToolChange: (tool: MapTool) => void
}

/** Line with endpoint nodes — matches polyline drawing semantics (distinct from Route). */
function LineSegmentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="5.5" cy="12" r="2" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
      <circle cx="18.5" cy="12" r="2" />
    </svg>
  )
}

const TOOLS: {
  tool: MapTool
  title: string
  icon: ComponentType<{ className?: string }>
}[] = [
  { tool: "pan", title: "Pan tool", icon: Hand },
  { tool: "point", title: "Draw point", icon: MapPin },
  { tool: "line", title: "Draw line", icon: LineSegmentIcon },
  { tool: "polygon", title: "Draw polygon", icon: Pentagon },
]

export function MapToolSelector({ mapTool, onMapToolChange }: Props) {
  const map = useMap()
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null)

  useEffect(() => {
    const container = document.createElement("div")
    container.className = "leaflet-bar leaflet-control"
    container.style.cssText = "background: transparent; border: none; box-shadow: none;"

    const control = new L.Control({ position: "topleft" })
    control.onAdd = () => {
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)
      return container
    }

    map.addControl(control)
    rootRef.current = createRoot(container)

    return () => {
      const root = rootRef.current
      rootRef.current = null
      map.removeControl(control)
      if (root) queueMicrotask(() => root.unmount())
    }
  }, [map])

  useEffect(() => {
    if (!rootRef.current) return
    rootRef.current.render(
      <div
        className="relative mt-14 flex flex-col items-center"
        role="toolbar"
        aria-label="Map drawing tools"
        aria-orientation="vertical"
      >
        <div className="flex flex-col items-center gap-0.5 rounded border border-border bg-background p-0.5 shadow-lg">
          {TOOLS.map(({ tool, title, icon: Icon }) => {
            const active = mapTool === tool
            return (
              <button
                key={tool}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={active}
                onClick={() => onMapToolChange(tool)}
                className={cn(
                  "flex items-center justify-center outline-none transition-all duration-150",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "z-10 -mx-2 h-11 w-12 rounded border border-border bg-background text-foreground shadow-md"
                    : "h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className={active ? "size-6" : "size-5"} />
              </button>
            )
          })}
        </div>
      </div>,
    )
  }, [mapTool, onMapToolChange])

  return null
}

import { createRoot } from "react-dom/client"
import { useEffect, useRef } from "react"
import L from "leaflet"
import { useMap } from "react-leaflet"
import { Button } from "@/components/ui/button"

type MapTool = "pan" | "point" | "line" | "polygon"

type Props = {
  mapTool: MapTool
  onMapToolChange: (tool: MapTool) => void
}

const TOOLS: { tool: MapTool; label: string; title: string }[] = [
  { tool: "pan",     label: "Pan",     title: "Pan tool"    },
  { tool: "point",   label: "Point",   title: "Draw point"  },
  { tool: "line",    label: "Line",    title: "Draw line"   },
  { tool: "polygon", label: "Polygon", title: "Draw polygon"},
]

export function MapToolSelector({ mapTool, onMapToolChange }: Props) {
  const map = useMap()
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null)
  const controlRef = useRef<L.Control | null>(null)

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
    controlRef.current = control
    rootRef.current = createRoot(container)

    return () => {
      const root = rootRef.current
      const ctrl = controlRef.current
      rootRef.current = null
      controlRef.current = null
      if (ctrl) map.removeControl(ctrl)
      if (root) queueMicrotask(() => root.unmount())
    }
  }, [map])

  useEffect(() => {
    if (!rootRef.current) return
    rootRef.current.render(
      <div className="flex flex-col gap-1 rounded border bg-background p-1 shadow-lg">
        {TOOLS.map(({ tool, label, title }) => (
          <Button
            key={tool}
            type="button"
            size="sm"
            variant={mapTool === tool ? "default" : "ghost"}
            title={title}
            onClick={() => onMapToolChange(tool)}
          >
            {label}
          </Button>
        ))}
      </div>,
    )
  }, [mapTool, onMapToolChange])

  return null
}
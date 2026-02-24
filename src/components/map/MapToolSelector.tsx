import { createRoot } from "react-dom/client"
import { useEffect, useRef } from "react"
import L from "leaflet"
import { useMap } from "react-leaflet"

type MapTool = "pan" | "point" | "line" | "polygon"

type Props = {
  mapTool: MapTool
  onMapToolChange: (tool: MapTool) => void
}

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
      // Defer unmount to avoid "synchronously unmount a root while React was already rendering"
      if (root) queueMicrotask(() => root.unmount())
    }
  }, [map])

  useEffect(() => {
    if (!rootRef.current) return

    rootRef.current.render(
      <div className="flex flex-col gap-1 p-1 bg-white rounded shadow-lg border border-border">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
            mapTool === "pan"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => onMapToolChange("pan")}
          title="Pan tool"
        >
          Pan
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
            mapTool === "point"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => onMapToolChange("point")}
          title="Draw point"
        >
          Point
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
            mapTool === "line"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => onMapToolChange("line")}
          title="Draw line"
        >
          Line
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
            mapTool === "polygon"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => onMapToolChange("polygon")}
          title="Draw polygon"
        >
          Polygon
        </button>
      </div>,
    )
  }, [mapTool, onMapToolChange])

  return null
}

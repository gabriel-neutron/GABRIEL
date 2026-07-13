import { useState } from "react"
import { Button } from "@/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"
import { executeOverpassQuery, normalizeQuery } from "@/modules/osm/services/overpass.service"
import { useProjectStore } from "@/store/useProjectStore"
import { useOsmQueryMenuStore } from "@/modules/osm/store/useOsmQueryMenuStore"

const DEFAULT_QUERY = `area["ISO3166-1"="RU"][admin_level=2]->.russia;
nwr["landuse"="military"](area.russia);
out geom;`

function defaultLayerName(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, " ")
  if (trimmed.length === 0) return `OSM ${new Date().toISOString().slice(0, 19)}`
  const firstLine = trimmed.split("\n")[0] ?? trimmed
  return firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine
}

/**
 * Dialog half of the OSM query UI (ADR 0007). Mounted once by `MainLayout` via
 * `osmModule.overlays`, independent of any trigger, so both the header dropdown
 * button (`OsmQueryTrigger`) and the command palette's `osm.query` command can
 * open it by flipping `useOsmQueryMenuStore.open`. Self-contained — reads/adds
 * layers via the project store directly.
 */
export function OsmQueryDialog() {
  const layers = useProjectStore((s) => s.layers)
  const addLayer = useProjectStore((s) => s.addLayer)
  const open = useOsmQueryMenuStore((s) => s.open)
  const setOpen = useOsmQueryMenuStore((s) => s.setOpen)
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRunQuery() {
    setError(null)
    setLoading(true)
    try {
      const result = await executeOverpassQuery(query, null)
      if (result.type === "empty") {
        setError("No features found for this query.")
        return
      }
      const normalizedQuery = normalizeQuery(query)
      const exists = layers.some((l) => l.sourceQuery === normalizedQuery)
      if (exists) {
        setError("A layer for this query already exists.")
        return
      }
      const name = defaultLayerName(query)
      addLayer({
        id: crypto.randomUUID(),
        name,
        visible: true,
        kind: "osm",
        osmData: result.geojson,
        sourceQuery: normalizedQuery,
      })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false)
          setError(null)
        }
      }}
    >
      <DialogContent
        className="z-[10000] max-w-lg"
        showCloseButton
        onInteractOutside={(event) => {
          if (loading) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (loading) event.preventDefault()
        }}
      >
        <DialogHeader className="pb-2 text-left">
          <DialogTitle id="osm-dialog-title" className="text-base font-semibold">
            OpenStreetMap query
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="osm-query">Overpass QL</Label>
            <textarea
              id="osm-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
              )}
              placeholder="Overpass QL query..."
              disabled={loading}
              rows={6}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="sm:justify-start">
          <Button
            onClick={() => {
              void handleRunQuery()
            }}
            disabled={loading || !query.trim()}
          >
            {loading ? "Running…" : "Run query"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

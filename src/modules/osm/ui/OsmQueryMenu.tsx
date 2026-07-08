import { useState } from "react"
import { Button } from "@/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Label } from "@/ui/label"
import { cn } from "@/lib/utils"
import { executeOverpassQuery, normalizeQuery } from "@/modules/osm/services/overpass.service"
import type { Layer } from "@/types/domain.types"

type Props = {
  layers: Layer[]
  onAddLayer: (layer: Layer) => void
}

const DEFAULT_QUERY = `area["ISO3166-1"="RU"][admin_level=2]->.russia;
nwr["landuse"="military"](area.russia);
out geom;`

function defaultLayerName(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, " ")
  if (trimmed.length === 0) return `OSM ${new Date().toISOString().slice(0, 19)}`
  const firstLine = trimmed.split("\n")[0] ?? trimmed
  return firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine
}

export function OsmQueryMenu({ layers, onAddLayer }: Props) {
  const [open, setOpen] = useState(false)
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
      const layer: Layer = {
        id: crypto.randomUUID(),
        name,
        visible: true,
        kind: "osm",
        osmData: result.geojson,
        sourceQuery: normalizedQuery,
      }
      onAddLayer(layer)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Query OpenStreetMap and add as layer"
      >
        OpenStreetMap
      </Button>
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
    </>
  )
}

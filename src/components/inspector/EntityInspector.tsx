import { useState, useEffect } from "react"
import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"
import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"
import { findOsmElementsAtPoint, type OsmElementCandidate } from "@/services/overpass.service"

/** Derive a short landuse/feature-type label from OSM tags for badge display. */
function getLanduseTypeLabel(tags: Record<string, string>): string | null {
  const keys = ["landuse", "boundary", "military", "amenity", "building", "place"]
  for (const key of keys) {
    const v = tags[key]
    if (v && typeof v === "string") return v
  }
  return null
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AFFILIATION_OPTIONS,
  DOMAIN_OPTIONS,
  ECHELON_OPTIONS,
  UNIT_TYPE_OPTIONS_GROUPED,
} from "./entityInspector.options"

type Props = {
  readOnly?: boolean
  selectedEntityId: string | null
  entities: MapEntity[]
  layers: Layer[]
  drawnGeometries: DrawnGeometry[]
  onUpdateEntity: (entityId: string, patch: Partial<MapEntity>) => void
  onDeleteEntity: (entityId: string) => void
  onDeleteGeometry: (geometryId: string) => void
}

function geometryLabel(g: DrawnGeometry): string {
  if (g.type === "point") return `Point (${g.lat.toFixed(4)}, ${g.lng.toFixed(4)})`
  if (g.type === "line") return `Line (${g.positions.length} vertices)`
  if (g.type === "polygon") return `Polygon (${g.rings[0]?.length ?? 0} vertices)`
  return "Geometry"
}

export function EntityInspector({
  readOnly = false,
  selectedEntityId,
  entities,
  layers,
  drawnGeometries,
  onUpdateEntity,
  onDeleteEntity,
  onDeleteGeometry,
}: Props) {
  const entity = selectedEntityId
    ? entities.find((e) => e.id === selectedEntityId) ?? null
    : null
  const linkedGeometries = entity
    ? drawnGeometries.filter((g) => g.entityId === entity.id)
    : []

  if (!entity) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        No selection
      </div>
    )
  }

  const currentEntity = entity
  const linkedGeometriesForReadOnly = drawnGeometries.filter((g) => g.entityId === currentEntity.id)
  const layerName = layers.find((l) => l.id === currentEntity.layerId)?.name ?? currentEntity.layerId
  const parentName = currentEntity.parentId
    ? entities.find((e) => e.id === currentEntity.parentId)?.name ?? currentEntity.parentId
    : null

  if (readOnly) {
    return (
      <div className="flex h-full min-w-0 flex-col p-4">
        <div className="min-h-0 space-y-3 overflow-auto text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Name</div>
            <div className="truncate">{currentEntity.name}</div>
          </div>
          {currentEntity.militaryUnitId != null && currentEntity.militaryUnitId !== "" && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Military unit ID</div>
              <div className="truncate">{currentEntity.militaryUnitId}</div>
            </div>
          )}
          {currentEntity.notes != null && currentEntity.notes !== "" && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{currentEntity.notes}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Echelon</div>
              <div>{currentEntity.echelon ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Type</div>
              <div>{currentEntity.type ?? "—"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Affiliation</div>
              <div>{currentEntity.affiliation ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Domain</div>
              <div>{currentEntity.domain ?? "—"}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Layer</div>
            <div className="truncate">{layerName}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Parent</div>
            <div className="truncate">{parentName ?? "—"}</div>
          </div>
          {currentEntity.osmRelationId != null && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">OSM relation</div>
              <div>{currentEntity.osmRelationId}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-muted-foreground">Linked geometries</div>
            {linkedGeometriesForReadOnly.length === 0 ? (
              <div className="text-muted-foreground">None</div>
            ) : (
              <ul className="mt-1 space-y-1">
                {linkedGeometriesForReadOnly.map((g) => (
                  <li key={g.id} className="truncate rounded border bg-muted/30 px-2 py-1 text-xs">
                    {geometryLabel(g)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  const typeValue = currentEntity.type ?? "unknown"
  const echelonValue = (currentEntity.echelon as SymbolEchelon) ?? "Division"
  const affiliationValue = (currentEntity.affiliation as SymbolAffiliation) ?? "Friend"
  const domainValue = (currentEntity.domain as SymbolDomain) ?? "Ground"
  const parentOptions = entities.filter((e) => e.id !== currentEntity.id)
  const firstPoint = linkedGeometries.find((g) => g.type === "point")
  const hasEchelonLayer = (echelon: string) => layers.some((l) => l.id === echelon)
  const isEchelonLayerSelected = layers.some(
    (l) => l.kind === "echelon" && l.id === currentEntity.layerId,
  )

  const [findDialogOpen, setFindDialogOpen] = useState(false)
  const [osmSearchLoading, setOsmSearchLoading] = useState(false)
  const [osmSearchError, setOsmSearchError] = useState<string | null>(null)
  const [osmCandidates, setOsmCandidates] = useState<OsmElementCandidate[]>([])

  useEffect(() => {
    if (!findDialogOpen || firstPoint?.type !== "point") return
    setOsmSearchError(null)
    setOsmCandidates([])
    setOsmSearchLoading(true)
    findOsmElementsAtPoint(firstPoint.lat, firstPoint.lng, { radiusMeters: 100 })
      .then(setOsmCandidates)
      .catch((e) => setOsmSearchError(e instanceof Error ? e.message : "Search failed"))
      .finally(() => setOsmSearchLoading(false))
  }, [findDialogOpen, firstPoint?.lat, firstPoint?.lng])

  function handleEchelonChange(v: string) {
    const patch: Partial<MapEntity> = { echelon: v }
    if (hasEchelonLayer(v)) patch.layerId = v
    onUpdateEntity(currentEntity.id, patch)
  }

  function handleSelectOsmRelation(relationId: number) {
    onUpdateEntity(currentEntity.id, { osmRelationId: relationId })
    setFindDialogOpen(false)
  }

  return (
    <div className="flex h-full min-w-0 flex-col p-4">
      <div className="min-h-0 space-y-4 overflow-auto">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={currentEntity.name}
            placeholder="e.g. 5th Motor Rifle Brigade"
            onChange={(e) => onUpdateEntity(currentEntity.id, { name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Military unit ID</Label>
          <Input
            value={currentEntity.militaryUnitId ?? ""}
            onChange={(e) =>
              onUpdateEntity(currentEntity.id, {
                militaryUnitId: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Notes</Label>
          <textarea
            data-slot="input"
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            placeholder="Free-form notes…"
            value={currentEntity.notes ?? ""}
            onChange={(e) =>
              onUpdateEntity(currentEntity.id, {
                notes: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Echelon</Label>
            <Select value={echelonValue} onValueChange={handleEchelonChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Echelon" />
              </SelectTrigger>
              <SelectContent>
                {ECHELON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={typeValue}
              onValueChange={(v) => onUpdateEntity(currentEntity.id, { type: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {UNIT_TYPE_OPTIONS_GROUPED.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Affiliation</Label>
            <Select
              value={affiliationValue}
              onValueChange={(v) => onUpdateEntity(currentEntity.id, { affiliation: v as SymbolAffiliation })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Affiliation" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Domain</Label>
            <Select
              value={domainValue}
              onValueChange={(v) => onUpdateEntity(currentEntity.id, { domain: v as SymbolDomain })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isEchelonLayerSelected && (
          <div className="space-y-2">
            <Label>Layer</Label>
            <Select
              value={currentEntity.layerId}
              onValueChange={(v) => onUpdateEntity(currentEntity.id, { layerId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select layer" />
              </SelectTrigger>
              <SelectContent>
                {layers.map((layer) => (
                  <SelectItem key={layer.id} value={layer.id}>
                    {layer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Parent (optional)</Label>
          <Select
            value={currentEntity.parentId ?? "__none__"}
            onValueChange={(v) => onUpdateEntity(currentEntity.id, { parentId: v === "__none__" ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No parent</SelectItem>
              {parentOptions.map((parent) => (
                <SelectItem key={parent.id} value={parent.id}>
                  {parent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>OSM relation</Label>
          <Input
            type="number"
            placeholder="None"
            value={currentEntity.osmRelationId ?? ""}
            onChange={(e) => {
              const raw = e.target.value
              const n = raw === "" ? null : parseInt(raw, 10)
              onUpdateEntity(currentEntity.id, {
                osmRelationId: raw === "" || Number.isNaN(n) ? null : n,
              })
            }}
          />
          {currentEntity.osmRelationId != null && (
            <p className="text-xs text-muted-foreground">
              Linked geometry is shown on the map.
            </p>
          )}
          {!currentEntity.osmRelationId && firstPoint?.type === "point" && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setFindDialogOpen(true)}
              >
                Find OSM at point
              </Button>
              {findDialogOpen && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="find-relations-dialog-title"
                >
                  <Card className="relative z-[10001] w-full max-w-md border bg-card shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle id="find-relations-dialog-title">
                        OSM at point (intersection + 100 m)
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFindDialogOpen(false)
                          setOsmSearchError(null)
                        }}
                        aria-label="Close"
                      >
                        Close
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {osmSearchLoading ? (
                        <p className="text-sm text-muted-foreground">Searching intersection and nearby (100 m)…</p>
                      ) : osmSearchError ? (
                        <p className="text-sm text-destructive">{osmSearchError}</p>
                      ) : osmCandidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No OSM elements found.</p>
                      ) : (
                        <ul className="max-h-64 space-y-1 overflow-auto">
                          {osmCandidates.map((el) => {
                            const label = el.tags?.name ?? `${el.type} ${el.id}`
                            const landuseType = getLanduseTypeLabel(el.tags)
                            const isRelation = el.type === "relation"
                            return (
                              <li key={`${el.type}/${el.id}`} className="flex items-center gap-2">
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {el.type}
                                </span>
                                {isRelation ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto min-w-0 flex-1 justify-start gap-2 text-left font-normal"
                                    onClick={() => handleSelectOsmRelation(el.id)}
                                  >
                                    <span className="min-w-0 truncate">{label}</span>
                                    {landuseType && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                        {landuseType}
                                      </span>
                                    )}
                                  </Button>
                                ) : (
                                  <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-muted-foreground" title="Only relations can be linked">
                                    <span className="min-w-0 truncate">{label}</span>
                                    {landuseType && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                        {landuseType}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
          {!currentEntity.osmRelationId && firstPoint?.type !== "point" && (
            <p className="text-xs text-muted-foreground">
              Add a point geometry to suggest relations (e.g. military base).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Linked geometries</Label>
          {linkedGeometries.length === 0 ? (
            <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
              No geometries linked. The symbol is placed at the first linked geometry. Draw on the map and link to this entity to add one.
            </div>
          ) : (
            <ul className="space-y-1">
              {linkedGeometries.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{geometryLabel(g)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => onDeleteGeometry(g.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-4">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDeleteEntity(currentEntity.id)}
          >
            Delete entity
          </Button>
        </div>
      </div>
    </div>
  )
}

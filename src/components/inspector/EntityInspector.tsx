import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilterableSelect } from "@/components/tree/FilterableSelect"
import type { DrawnGeometry, Layer, MapEntity, PositionMode } from "@/types/domain.types"
import {
  AFFILIATION_OPTIONS,
  DOMAIN_OPTIONS,
  ECHELON_OPTIONS,
  type SymbolAffiliation,
  type SymbolDomain,
} from "@/types/symbol.types"
import { Trash2 } from "lucide-react"
import { UNIT_TYPE_OPTIONS_GROUPED } from "./entityInspector.options"
import { FindOsmAtPointDialog } from "./FindOsmAtPointDialog"
import { useEntityInspector } from "./useEntityInspector"

const POSITION_MODE_OPTIONS: { value: PositionMode; label: string }[] = [
  { value: "own", label: "Own geometry" },
  { value: "parent", label: "Linked to parent" },
  { value: "none", label: "Unknown location" },
]

function geometryLabel(g: DrawnGeometry): string {
  if (g.type === "point") return `Point (${g.lat.toFixed(4)}, ${g.lng.toFixed(4)})`
  if (g.type === "line") return `Line (${g.positions.length} vertices)`
  if (g.type === "polygon") return `Polygon (${g.rings[0]?.length ?? 0} vertices)`
  return "Geometry"
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "") return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function positionModeLabel(mode?: PositionMode): string {
  return POSITION_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? "Own geometry"
}

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
  const {
    entity,
    linkedGeometries,
    layerName,
    parentName,
    typeValue,
    echelonValue,
    affiliationValue,
    domainValue,
    positionModeValue,
    isExactPositionValue,
    parentOptions,
    firstPoint,
    isEchelonLayerSelected,
    findDialogOpen,
    setFindDialogOpen,
    handleNameChange,
    handleEchelonChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
    sources,
    newSource,
    setNewSource,
    handleAddSource,
    handleRemoveSource,
  } = useEntityInspector({
    selectedEntityId,
    entities,
    layers,
    drawnGeometries,
    onUpdateEntity,
    onDeleteGeometry,
  })

  if (!entity) {
    return <div className="p-4">No selection</div>
  }

  if (readOnly) {
    return (
      <div className="space-y-3 p-4">
        <ReadOnlyField label="Name">
          <span className="truncate">{entity.name}</span>
        </ReadOnlyField>
        {entity.militaryUnitId != null && entity.militaryUnitId !== "" && (
          <ReadOnlyField label="Military unit ID">
            <span className="truncate">{entity.militaryUnitId}</span>
          </ReadOnlyField>
        )}
        {entity.notes != null && entity.notes !== "" && (
          <ReadOnlyField label="Notes">
            <span className="whitespace-pre-wrap">{entity.notes}</span>
          </ReadOnlyField>
        )}
        {sources.length > 0 && (
          <ReadOnlyField label="Sources">
            <ul className="mt-1 space-y-1 text-xs">
              {sources.map((src, index) => (
                <li key={index} className="flex items-start gap-2">
                  {isUrl(src) ? (
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      title={src}
                      className="min-w-0 flex-1 truncate text-blue-600 hover:underline"
                    >
                      {src}
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{src}</span>
                  )}
                </li>
              ))}
            </ul>
          </ReadOnlyField>
        )}
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Echelon">{entity.echelon ?? "—"}</ReadOnlyField>
          <ReadOnlyField label="Type">
            {entity.type ? capitalizeFirst(entity.type) : "—"}
          </ReadOnlyField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Affiliation">{entity.affiliation ?? "—"}</ReadOnlyField>
          <ReadOnlyField label="Domain">{entity.domain ?? "—"}</ReadOnlyField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="Position">
            <span>{positionModeLabel(entity.positionMode)}</span>
          </ReadOnlyField>
          <ReadOnlyField label="Exact position">
            <span>{entity.isExactPosition ? "Yes" : "No"}</span>
          </ReadOnlyField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="OSM relation">
            {entity.osmRelationId != null ? entity.osmRelationId : "—"}
          </ReadOnlyField>
        </div>
        <ReadOnlyField label="Layer">
          <span className="truncate">{layerName}</span>
        </ReadOnlyField>
        <ReadOnlyField label="Parent">
          <span className="truncate">{parentName ?? "—"}</span>
        </ReadOnlyField>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Linked geometries</div>
          {linkedGeometries.length === 0 ? (
            <div className="text-muted-foreground">None</div>
          ) : (
            <ul className="mt-1 space-y-1">
              {linkedGeometries.map((g) => (
                <li key={g.id} className="truncate rounded border bg-muted/30 px-2 py-1 text-xs">
                  {geometryLabel(g)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  const hasParent = entity.parentId != null

  return (
    <div className="p-2">
      <FieldGroup className="gap-4 [&_[data-slot=field]]:gap-1">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            value={entity.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>Military unit ID</FieldLabel>
          <Input
            value={entity.militaryUnitId ?? ""}
            onChange={(e) =>
              onUpdateEntity(entity.id, {
                militaryUnitId: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            placeholder="Free-form notes…"
            value={entity.notes ?? ""}
            onChange={(e) =>
              onUpdateEntity(entity.id, {
                notes: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel>Sources</FieldLabel>
          {sources.length > 0 && (
            <ul className="mb-2 space-y-1 text-xs">
              {sources.map((src, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {isUrl(src) ? (
                      <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        title={src}
                        className="block truncate text-blue-600 hover:underline"
                      >
                        {src}
                      </a>
                    ) : (
                      <span className="block whitespace-pre-wrap break-words">{src}</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0"
                    onClick={() => handleRemoveSource(index)}
                    aria-label="Remove source"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Add source URL or note"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSource()
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddSource}
              disabled={newSource.trim() === ""}
            >
              Add
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel>Echelon</FieldLabel>
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
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select
              value={typeValue}
              onValueChange={(v) => onUpdateEntity(entity.id, { type: v })}
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
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel>Affiliation</FieldLabel>
            <Select
              value={affiliationValue}
              onValueChange={(v) =>
                onUpdateEntity(entity.id, { affiliation: v as SymbolAffiliation })
              }
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
          </Field>
          <Field>
            <FieldLabel>Domain</FieldLabel>
            <Select
              value={domainValue}
              onValueChange={(v) =>
                onUpdateEntity(entity.id, { domain: v as SymbolDomain })
              }
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
          </Field>
        </div>
        {!isEchelonLayerSelected && (
          <Field>
            <FieldLabel>Layer</FieldLabel>
            <Select value={entity.layerId} onValueChange={(v) => onUpdateEntity(entity.id, { layerId: v })}>
              <SelectTrigger className="h-8 text-xs">
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
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel>Parent</FieldLabel>
            <FilterableSelect
              options={parentOptions.map((p) => ({ id: p.id, name: p.name, echelon: p.echelon }))}
              value={entity.parentId ?? "__none__"}
              onValueChange={(v) => handleParentChange(v === "__none__" ? null : v)}
            />
          </Field>
          <Field>
            <FieldLabel>Position</FieldLabel>
            <Select
              value={positionModeValue}
              onValueChange={(v) => handlePositionModeChange(v as PositionMode)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_MODE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.value === "parent" && !hasParent}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positionModeValue === "own" && (
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={isExactPositionValue}
                  onCheckedChange={handleIsExactPositionChange}
                  aria-label="Toggle exact position"
                />
                Exact position
              </label>
            )}
          </Field>
        </div>
        <Field>
          <FieldLabel>OSM relation</FieldLabel>
          <Input
            type="number"
            placeholder="None"
            value={entity.osmRelationId ?? ""}
            onChange={(e) => {
              const raw = e.target.value
              const n = raw === "" ? null : parseInt(raw, 10)
              onUpdateEntity(entity.id, {
                osmRelationId: raw === "" || Number.isNaN(n) ? null : n,
              })
            }}
          />
          {!entity.osmRelationId && firstPoint?.type === "point" && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => setFindDialogOpen(true)}
              >
                Find OSM at point
              </Button>
              <FindOsmAtPointDialog
                open={findDialogOpen}
                onClose={() => setFindDialogOpen(false)}
                lat={firstPoint.lat}
                lng={firstPoint.lng}
                onSelectRelation={handleSelectOsmRelation}
              />
            </>
          )}
          {!entity.osmRelationId && firstPoint?.type !== "point" && positionModeValue === "own" && (
            <p className="text-xs text-muted-foreground">
              Add a point geometry to suggest relations (e.g. military base).
            </p>
          )}
        </Field>
        {positionModeValue === "own" && (
          <Field>
            <FieldLabel className="text-muted-foreground">Linked geometries</FieldLabel>
            {linkedGeometries.length === 0 ? (
              <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
                No geometries linked. The symbol is placed at the first linked geometry. Draw on the
                map and link to this entity to add one.
              </div>
            ) : (
              <ul className="space-y-1">
                {linkedGeometries.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-sm"
                  >
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
          </Field>
        )}
        <Field>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDeleteEntity(entity.id)}
          >
            Delete entity
          </Button>
        </Field>
      </FieldGroup>
    </div>
  )
}

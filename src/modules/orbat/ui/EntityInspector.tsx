import { useEffect, useMemo, useState } from "react"
import { Button } from "@/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/ui/field"
import { Input } from "@/ui/input"
import { Switch } from "@/ui/switch"
import { Textarea } from "@/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { FilterableSelect } from "@/components/shared/FilterableSelect"
import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import {
  AFFILIATION_OPTIONS,
  DOMAIN_OPTIONS,
  ECHELON_OPTIONS,
  type SymbolAffiliation,
  type SymbolDomain,
} from "@/types/symbol.types"
import { ORGANISATION_TYPE_LABELS, ORGANISATION_TYPES } from "@/types/organisation.types"
import { UNIT_TYPE_OPTIONS_GROUPED } from "./entityInspector.options"
import { FindOsmAtPointDialog } from "@/modules/osm/ui/FindOsmAtPointDialog"
import { useEntityInspector } from "@/modules/orbat/hooks/useEntityInspector"
import { useModuleContext } from "@/shell/moduleContext"
import { useProjectStore } from "@/store/useProjectStore"
import { ReadOnlyField, SourcesList, LinkedGeometriesList } from "@/components/shared/InspectorFields"
import type { AdmiraltyCredibility, AdmiraltyReliability } from "@/core/provenance/admiralty"
import type { CredibilityMeta, RatingMeta } from "@/core/provenance/ratingMeta"
import { matchesForEntity } from "@/core/identity/matchCandidates"
import { DuplicateMatchesSection } from "./DuplicateMatchesSection"

const POSITION_MODE_OPTIONS: { value: PositionMode; label: string }[] = [
  { value: "own", label: "Own geometry" },
  { value: "parent", label: "Linked to parent" },
  { value: "none", label: "Unknown location" },
]

type FieldDraft = {
  name: string
  militaryUnitId: string
  notes: string
  osmRelationId: string
}

function draftFromEntity(entity: MapEntity): FieldDraft {
  return {
    name: entity.name ?? "",
    militaryUnitId: entity.militaryUnitId ?? "",
    notes: entity.notes ?? "",
    osmRelationId: entity.osmRelationId?.toString() ?? "",
  }
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "") return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function positionModeLabel(mode?: PositionMode): string {
  return POSITION_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? "Own geometry"
}

function EnrichedSessionBlock({
  overlay,
  variant,
}: {
  overlay: Record<string, unknown>
  variant: "readonly" | "edit"
}) {
  const entries = Object.entries(overlay)
  if (entries.length === 0) return null

  if (variant === "readonly") {
    return (
      <ReadOnlyField label="Enriched (session)">
        <ul className="mt-1 space-y-1 text-xs">
          {entries.map(([field, value]) => (
            <li key={field}>
              <span className="font-medium">{field}:</span> {String(value)}{" "}
              <span className="text-emerald-600">(Enriched)</span>
            </li>
          ))}
        </ul>
      </ReadOnlyField>
    )
  }

  return (
    <Field>
      <div className="rounded border bg-muted/30 p-2 text-xs">
        {entries.map(([field, value]) => (
          <p key={field}>
            <span className="font-medium">{field}:</span> {String(value)}{" "}
            <span className="text-emerald-600">(Enriched)</span>
          </p>
        ))}
      </div>
    </Field>
  )
}

type Props = {
  readOnly?: boolean
  enrichedOverlay?: Record<string, unknown>
}

type EntityInspectorReadOnlyViewProps = {
  entity: MapEntity
  layerName: string
  parentName: string | null
  linkedGeometries: DrawnGeometry[]
  sources: string[]
  reliabilities: (AdmiraltyReliability | null)[]
  reliabilityMetas: (RatingMeta | undefined)[]
  credibilities: (AdmiraltyCredibility | null)[]
  credibilityMetas: (CredibilityMeta | undefined)[]
  enrichedOverlay: Record<string, unknown>
}

function EntityInspectorReadOnlyView({
  entity,
  layerName,
  parentName,
  linkedGeometries,
  sources,
  reliabilities,
  reliabilityMetas,
  credibilities,
  credibilityMetas,
  enrichedOverlay,
}: EntityInspectorReadOnlyViewProps) {
  const isCorporate = entity.kind === "corporate"
  return (
    <div className="space-y-3 p-4">
      <ReadOnlyField label="Name">
        <span className="truncate">{entity.name}</span>
      </ReadOnlyField>
      {!isCorporate && entity.militaryUnitId != null && entity.militaryUnitId !== "" && (
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
          <SourcesList
            sources={sources}
            readOnly
            reliabilities={reliabilities}
            reliabilityMetas={reliabilityMetas}
            credibilities={credibilities}
            credibilityMetas={credibilityMetas}
          />
        </ReadOnlyField>
      )}
      <EnrichedSessionBlock overlay={enrichedOverlay} variant="readonly" />
      {isCorporate ? (
        <ReadOnlyField label="Type">
          {entity.type ? ORGANISATION_TYPE_LABELS[entity.type as keyof typeof ORGANISATION_TYPE_LABELS] : "—"}
        </ReadOnlyField>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ReadOnlyField label="Echelon">{entity.echelon ?? "—"}</ReadOnlyField>
            <ReadOnlyField label="Type">{entity.type ? capitalizeFirst(entity.type) : "—"}</ReadOnlyField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ReadOnlyField label="Affiliation">{entity.affiliation ?? "—"}</ReadOnlyField>
            <ReadOnlyField label="Domain">{entity.domain ?? "—"}</ReadOnlyField>
          </div>
        </>
      )}
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
      {!isCorporate && (
        <ReadOnlyField label="Layer">
          <span className="truncate">{layerName}</span>
        </ReadOnlyField>
      )}
      <ReadOnlyField label="Parent">
        <span className="truncate">{parentName ?? "—"}</span>
      </ReadOnlyField>
      <div>
        <div className="text-xs font-medium text-muted-foreground">Linked geometries</div>
        <LinkedGeometriesList linkedGeometries={linkedGeometries} />
      </div>
    </div>
  )
}

export function EntityInspector({ readOnly: readOnlyProp, enrichedOverlay: enrichedOverlayProp }: Props) {
  // Falls back to ModuleContext (ADR 0007) when rendered through the manifest's
  // detailRenderer, which can't pass props — explicit props (e.g. Storybook) still win.
  const moduleCtx = useModuleContext()
  const readOnly = readOnlyProp ?? moduleCtx.readOnly
  const enrichedOverlay = enrichedOverlayProp ?? moduleCtx.enrichedOverlay
  const layers = useProjectStore((s) => s.layers)
  const updateEntity = useProjectStore((s) => s.updateEntity)
  const deleteGeometry = useProjectStore((s) => s.deleteGeometry)
  const assignableLayers = layers.filter((l) => l.osmData == null)
  const allEntities = useProjectStore((s) => s.entities)
  const mergeEntities = useProjectStore((s) => s.mergeEntities)

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
    handleTypeChange,
    handleEchelonChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
    sourceEditor,
  } = useEntityInspector()
  const {
    sources,
    reliabilities,
    reliabilityMetas,
    credibilities,
    credibilityMetas,
    draft: newSource,
    setDraft: setNewSource,
    add: handleAddSource,
    remove: handleRemoveSource,
    rate: handleRateSource,
  } = sourceEditor

  const [draft, setDraft] = useState<FieldDraft>(() =>
    entity != null ? draftFromEntity(entity) : { name: "", militaryUnitId: "", notes: "", osmRelationId: "" },
  )

  useEffect(() => {
    if (entity != null) setDraft(draftFromEntity(entity))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.id])

  const duplicateCandidates = useMemo(() => {
    if (entity == null) return []
    const byId = new Map(allEntities.map((e) => [e.id, e]))
    return matchesForEntity(entity, allEntities).map((m) => ({
      id: m.bId,
      name: byId.get(m.bId)?.name ?? m.bId,
      score: m.score,
      reason: m.reason,
    }))
  }, [entity, allEntities])

  function handleDeleteEntity(entityId: string): void {
    const noun = entity?.kind === "corporate" ? "organisation" : "entity"
    if (!window.confirm(`Delete this ${noun} and all its linked geometries?`)) return
    useProjectStore.getState().deleteEntity(entityId)
  }

  if (!entity) {
    return <div className="p-4">No selection</div>
  }

  if (readOnly) {
    return (
      <EntityInspectorReadOnlyView
        entity={entity}
        layerName={layerName}
        parentName={parentName}
        linkedGeometries={linkedGeometries}
        sources={sources}
        reliabilities={reliabilities}
        reliabilityMetas={reliabilityMetas}
        credibilities={credibilities}
        credibilityMetas={credibilityMetas}
        enrichedOverlay={enrichedOverlay}
      />
    )
  }

  const isCorporate = entity.kind === "corporate"
  const hasParent = entity.parentId != null

  return (
    <div className="p-2">
      <FieldGroup className="gap-4 [&_[data-slot=field]]:gap-1">
        <EnrichedSessionBlock overlay={enrichedOverlay} variant="edit" />
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => handleNameChange(draft.name)}
          />
        </Field>
        {!isCorporate && (
          <Field>
            <FieldLabel>Military unit ID</FieldLabel>
            <Input
              value={draft.militaryUnitId}
              onChange={(e) => setDraft((d) => ({ ...d, militaryUnitId: e.target.value }))}
              onBlur={() =>
                updateEntity(entity.id, {
                  militaryUnitId: draft.militaryUnitId === "" ? null : draft.militaryUnitId,
                })
              }
            />
          </Field>
        )}
        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            placeholder="Free-form notes…"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            onBlur={() =>
              updateEntity(entity.id, {
                notes: draft.notes === "" ? null : draft.notes,
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel>Sources</FieldLabel>
          <SourcesList
            sources={sources}
            readOnly={false}
            onRemove={handleRemoveSource}
            reliabilities={reliabilities}
            reliabilityMetas={reliabilityMetas}
            credibilities={credibilities}
            credibilityMetas={credibilityMetas}
            onRate={handleRateSource}
          />
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
        {isCorporate ? (
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={typeValue} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {ORGANISATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{ORGANISATION_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel>Echelon</FieldLabel>
                <Select value={echelonValue} onValueChange={handleEchelonChange}>
                  <SelectTrigger className="h-8 text-sm">
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
                <Select value={typeValue} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-8 text-sm">
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
                  onValueChange={(v) => updateEntity(entity.id, { affiliation: v as SymbolAffiliation })}
                >
                  <SelectTrigger className="h-8 text-sm">
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
                  onValueChange={(v) => updateEntity(entity.id, { domain: v as SymbolDomain })}
                >
                  <SelectTrigger className="h-8 text-sm">
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
                <Select value={entity.layerId} onValueChange={(v) => updateEntity(entity.id, { layerId: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select layer" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableLayers.map((layer) => (
                      <SelectItem key={layer.id} value={layer.id}>
                        {layer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </>
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
            <Select value={positionModeValue} onValueChange={(v) => handlePositionModeChange(v as PositionMode)}>
              <SelectTrigger className="h-8 text-sm">
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
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
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
            value={draft.osmRelationId}
            onChange={(e) => setDraft((d) => ({ ...d, osmRelationId: e.target.value }))}
            onBlur={() => {
              const n = draft.osmRelationId === "" ? null : parseInt(draft.osmRelationId, 10)
              updateEntity(entity.id, {
                osmRelationId: draft.osmRelationId === "" || Number.isNaN(n) ? null : n,
              })
            }}
          />
          {!entity.osmRelationId && firstPoint?.type === "point" && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 w-full"
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
            <LinkedGeometriesList
              linkedGeometries={linkedGeometries}
              onDeleteGeometry={deleteGeometry}
              emptyEditMessage={
                isCorporate
                  ? "No geometries linked. Draw on the map and link to this organisation."
                  : "No geometries linked. The symbol is placed at the first linked geometry. Draw on the map and link to this entity to add one."
              }
            />
          </Field>
        )}
        {duplicateCandidates.length > 0 && (
          <Field>
            <DuplicateMatchesSection
              candidates={duplicateCandidates}
              onMerge={(otherId) => mergeEntities(entity.id, otherId)}
            />
          </Field>
        )}
        <Field>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => handleDeleteEntity(entity.id)}
          >
            {isCorporate ? "Delete organisation" : "Delete entity"}
          </Button>
        </Field>
      </FieldGroup>
    </div>
  )
}

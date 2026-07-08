import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilterableSelect } from "@/components/shared/FilterableSelect"
import type { DrawnGeometry, PositionMode } from "@/types/domain.types"
import type { Organisation } from "@/types/organisation.types"
import { ORGANISATION_TYPE_LABELS, ORGANISATION_TYPES } from "@/types/organisation.types"
import { Trash2 } from "lucide-react"
import { FindOsmAtPointDialog } from "@/modules/osm/ui/FindOsmAtPointDialog"
import { useOrganisationInspector } from "./useOrganisationInspector"
import { useProjectStore } from "@/store/useProjectStore"

const POSITION_MODE_OPTIONS: { value: PositionMode; label: string }[] = [
  { value: "own", label: "Own geometry" },
  { value: "parent", label: "Linked to parent" },
  { value: "none", label: "Unknown location" },
]

type FieldDraft = { name: string; notes: string; osmRelationId: string }

function draftFromOrg(org: Organisation): FieldDraft {
  return {
    name: org.name ?? "",
    notes: org.notes ?? "",
    osmRelationId: org.osmRelationId?.toString() ?? "",
  }
}

function geometryLabel(g: DrawnGeometry): string {
  if (g.type === "point") return `Point (${g.lat.toFixed(4)}, ${g.lng.toFixed(4)})`
  if (g.type === "line") return `Line (${g.positions.length} vertices)`
  if (g.type === "polygon") return `Polygon (${g.rings[0]?.length ?? 0} vertices)`
  return "Geometry"
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function positionModeLabel(mode?: PositionMode): string {
  return POSITION_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? "Own geometry"
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function SourcesList({
  sources,
  readOnly,
  onRemove,
}: {
  sources: string[]
  readOnly: boolean
  onRemove?: (index: number) => void
}) {
  if (sources.length === 0) return null
  const listClass = readOnly ? "mt-1 space-y-1 text-sm" : "mb-2 space-y-1 text-sm"
  return (
    <ul className={listClass}>
      {sources.map((src, index) => (
        <li key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {isUrl(src) ? (
              <a href={src} target="_blank" rel="noreferrer" title={src} className={readOnly ? "min-w-0 flex-1 truncate text-blue-600 hover:underline" : "block truncate text-blue-600 hover:underline"}>
                {src}
              </a>
            ) : (
              <span className={readOnly ? "min-w-0 flex-1 whitespace-pre-wrap break-words" : "block whitespace-pre-wrap break-words"}>
                {src}
              </span>
            )}
          </div>
          {!readOnly && onRemove != null && (
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => onRemove(index)} aria-label="Remove source">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function LinkedGeometriesList({
  linkedGeometries,
  onDeleteGeometry,
}: {
  linkedGeometries: DrawnGeometry[]
  onDeleteGeometry?: (id: string) => void
}) {
  if (linkedGeometries.length === 0) {
    if (onDeleteGeometry) {
      return (
        <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
          No geometries linked. Draw on the map and link to this organisation.
        </div>
      )
    }
    return <div className="text-muted-foreground">None</div>
  }
  if (onDeleteGeometry) {
    return (
      <ul className="space-y-1">
        {linkedGeometries.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-sm">
            <span className="min-w-0 truncate">{geometryLabel(g)}</span>
            <Button variant="ghost" size="sm" className="h-7 shrink-0 text-destructive hover:text-destructive" onClick={() => onDeleteGeometry(g.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="mt-1 space-y-1">
      {linkedGeometries.map((g) => (
        <li key={g.id} className="truncate rounded border bg-muted/30 px-2 py-1 text-xs">{geometryLabel(g)}</li>
      ))}
    </ul>
  )
}

type Props = { readOnly?: boolean }

function OrganisationInspectorReadOnlyView({ org, parentName, linkedGeometries, sources }: {
  org: Organisation
  parentName: string | null
  linkedGeometries: DrawnGeometry[]
  sources: string[]
}) {
  return (
    <div className="space-y-3 p-4">
      <ReadOnlyField label="Name"><span className="truncate">{org.name}</span></ReadOnlyField>
      <ReadOnlyField label="Type"><span>{ORGANISATION_TYPE_LABELS[org.type]}</span></ReadOnlyField>
      {org.notes != null && org.notes !== "" && (
        <ReadOnlyField label="Notes"><span className="whitespace-pre-wrap">{org.notes}</span></ReadOnlyField>
      )}
      {sources.length > 0 && (
        <ReadOnlyField label="Sources"><SourcesList sources={sources} readOnly /></ReadOnlyField>
      )}
      <div className="grid grid-cols-2 gap-2">
        <ReadOnlyField label="Position"><span>{positionModeLabel(org.positionMode)}</span></ReadOnlyField>
        <ReadOnlyField label="Exact position"><span>{org.isExactPosition ? "Yes" : "No"}</span></ReadOnlyField>
      </div>
      <ReadOnlyField label="OSM relation">{org.osmRelationId != null ? org.osmRelationId : "—"}</ReadOnlyField>
      <ReadOnlyField label="Parent"><span className="truncate">{parentName ?? "—"}</span></ReadOnlyField>
      <div>
        <div className="text-xs font-medium text-muted-foreground">Linked geometries</div>
        <LinkedGeometriesList linkedGeometries={linkedGeometries} />
      </div>
    </div>
  )
}

export function OrganisationInspector({ readOnly = false }: Props) {
  const { deleteGeometry } = useProjectStore()

  const {
    organisation,
    linkedGeometries,
    parentName,
    typeValue,
    positionModeValue,
    isExactPositionValue,
    parentOptions,
    firstPoint,
    findDialogOpen,
    setFindDialogOpen,
    handleNameChange,
    handleTypeChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
    sourceEditor,
  } = useOrganisationInspector()

  const { sources, draft: newSource, setDraft: setNewSource, add: handleAddSource, remove: handleRemoveSource } = sourceEditor

  const [draft, setDraft] = useState<FieldDraft>(() =>
    organisation != null ? draftFromOrg(organisation) : { name: "", notes: "", osmRelationId: "" },
  )

  useEffect(() => {
    if (organisation != null) setDraft(draftFromOrg(organisation))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation?.id])

  function handleDeleteOrganisation(orgId: string): void {
    if (!window.confirm("Delete this organisation and all its linked geometries?")) return
    useProjectStore.getState().deleteOrganisation(orgId)
  }

  if (!organisation) {
    return <div className="p-4">No selection</div>
  }

  if (readOnly) {
    return (
      <OrganisationInspectorReadOnlyView
        org={organisation}
        parentName={parentName}
        linkedGeometries={linkedGeometries}
        sources={sources}
      />
    )
  }

  return (
    <div className="p-2">
      <FieldGroup className="gap-4 [&_[data-slot=field]]:gap-1">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={() => handleNameChange(draft.name)}
          />
        </Field>

        <Field>
          <FieldLabel>Type</FieldLabel>
          <Select value={typeValue} onValueChange={(v) => handleTypeChange(v as typeof typeValue)}>
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

        <Field>
          <FieldLabel>Notes</FieldLabel>
          <Textarea
            placeholder="Free-form notes…"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            onBlur={() => useProjectStore.getState().updateOrganisation(organisation.id, { notes: draft.notes === "" ? null : draft.notes })}
          />
        </Field>

        <Field>
          <FieldLabel>Sources</FieldLabel>
          <SourcesList sources={sources} readOnly={false} onRemove={handleRemoveSource} />
          <div className="flex gap-2">
            <Input
              placeholder="Add source URL or note"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSource() } }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddSource} disabled={newSource.trim() === ""}>
              Add
            </Button>
          </div>
        </Field>

        <Field>
          <FieldLabel>Position mode</FieldLabel>
          <Select value={positionModeValue} onValueChange={(v) => handlePositionModeChange(v as PositionMode)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITION_MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {positionModeValue === "own" && (
          <Field>
            <label className="flex cursor-pointer items-center gap-3">
              <Switch checked={isExactPositionValue} onCheckedChange={handleIsExactPositionChange} />
              <span className="text-sm">Exact position</span>
            </label>
          </Field>
        )}

        <Field>
          <FieldLabel>OSM relation ID</FieldLabel>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Relation ID"
              value={draft.osmRelationId}
              onChange={(e) => setDraft((d) => ({ ...d, osmRelationId: e.target.value }))}
              onBlur={() => {
                const n = parseInt(draft.osmRelationId, 10)
                useProjectStore.getState().updateOrganisation(organisation.id, { osmRelationId: isNaN(n) ? null : n })
              }}
            />
            {!organisation.osmRelationId && firstPoint?.type === "point" && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setFindDialogOpen(true)}>
                Find OSM
              </Button>
            )}
          </div>
          {firstPoint?.type === "point" && (
            <FindOsmAtPointDialog
              open={findDialogOpen}
              lat={firstPoint.lat}
              lng={firstPoint.lng}
              onSelectRelation={handleSelectOsmRelation}
              onClose={() => setFindDialogOpen(false)}
            />
          )}
        </Field>

        <Field>
          <FieldLabel>Parent organisation</FieldLabel>
          <FilterableSelect
            options={parentOptions.map((o) => ({ id: o.id, name: o.name }))}
            value={organisation.parentId ?? "__none__"}
            onValueChange={(v) => handleParentChange(v === "__none__" ? null : v)}
            placeholder="No parent"
          />
        </Field>

        {positionModeValue === "own" && (
          <Field>
            <FieldLabel>Linked geometries</FieldLabel>
            <LinkedGeometriesList
              linkedGeometries={linkedGeometries}
              onDeleteGeometry={(id) => deleteGeometry(id)}
            />
          </Field>
        )}

        <Field>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => handleDeleteOrganisation(organisation.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete organisation
          </Button>
        </Field>
      </FieldGroup>
    </div>
  )
}

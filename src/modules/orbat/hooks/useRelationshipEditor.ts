import { useCallback, useMemo, useState } from "react"
import type { MapEntity } from "@/types/domain.types"
import type { RelationshipType } from "@/core/relationship/relationship"
import type { RelationshipViolation } from "@/core/relationship/validate"
import type { EdgeTypeDefinition } from "@/core/relationship/vocabulary"
import { EDGE_TYPES } from "@/core/relationship/vocabulary"
import { buildMetadata, metadataFieldsFor, orderTargets, type MetadataFieldSpec, type TargetCandidate } from "@/core/relationship/edgeForm"
import { applyAuthorEdge, applyDeleteEdge, applyEndDate } from "./relationshipEditorCommands"
import { useProjectStore } from "@/store/useProjectStore"

/** One edge as the section renders it: the far end named, and the direction that naming implies. */
export type EdgeRow = {
  id: string
  /** "out" — the inspected entity is the edge's A, the end every type is named from. */
  direction: "out" | "in"
  definition: EdgeTypeDefinition | undefined
  type: RelationshipType
  otherId: string
  otherName: string
  startDate: string | null
  endDate: string | null
  metadata: Record<string, unknown>
}

export type EdgeDraftState = {
  type: RelationshipType
  toId: string
  startDate: string
  endDate: string
  metadata: Record<string, string>
}

const EMPTY_DRAFT: EdgeDraftState = {
  type: "supplies", toId: "", startDate: "", endDate: "", metadata: {},
}

function blankToNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

function candidateOf(entity: MapEntity): TargetCandidate {
  return { id: entity.id, name: entity.name, kind: entity.kind }
}

export type RelationshipEditorState = {
  entity: MapEntity | null
  rows: EdgeRow[]
  draft: EdgeDraftState
  setType: (type: RelationshipType) => void
  setToId: (toId: string) => void
  setStartDate: (value: string) => void
  setEndDate: (value: string) => void
  setMetadata: (key: string, value: string) => void
  definition: EdgeTypeDefinition | undefined
  metadataFields: MetadataFieldSpec[]
  targets: TargetCandidate[]
  violations: RelationshipViolation[]
  canCommit: boolean
  commit: () => void
  endDate: (edgeId: string, value: string | null) => void
  remove: (edgeId: string) => void
}

/**
 * The relationship editor's state, composed from the store — no rule of its own.
 *
 * What is authorable, what a type's fields are, which targets to offer and whether a draft may be
 * committed are all decided in `core/relationship/` and in `relationshipEditorCommands.ts`; this
 * holds the draft, and hands the pieces to a component thin enough that Storybook can carry what
 * no test here can see.
 */
export function useRelationshipEditor(): RelationshipEditorState {
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  const entities = useProjectStore((s) => s.entities)
  const relationships = useProjectStore((s) => s.relationships)
  const setRelationships = useProjectStore((s) => s.setRelationships)

  const [draft, setDraft] = useState<EdgeDraftState>(EMPTY_DRAFT)
  const [violations, setViolations] = useState<RelationshipViolation[]>([])

  const entity = selectedEntityId ? entities.find((e) => e.id === selectedEntityId) ?? null : null

  const nameById = useMemo(() => new Map(entities.map((e) => [e.id, e.name])), [entities])
  const entityIds = useMemo(() => new Set(entities.map((e) => e.id)), [entities])

  const rows = useMemo<EdgeRow[]>(() => {
    if (entity == null) return []
    const out: EdgeRow[] = []
    for (const rel of relationships) {
      const isOut = rel.fromId === entity.id
      const isIn = rel.toId === entity.id
      if (!isOut && !isIn) continue
      const otherId = isOut ? rel.toId : rel.fromId
      out.push({
        id: rel.id,
        direction: isOut ? "out" : "in",
        definition: EDGE_TYPES[rel.type],
        type: rel.type,
        otherId,
        otherName: nameById.get(otherId) ?? otherId,
        startDate: rel.startDate,
        endDate: rel.endDate,
        metadata: (rel.metadata ?? {}) as Record<string, unknown>,
      })
    }
    return out
  }, [entity, relationships, nameById])

  const targets = useMemo(() => {
    if (entity == null) return []
    const candidates = [...entities]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map(candidateOf)
    return orderTargets(draft.type, entity.id, candidates)
  }, [entity, entities, draft.type])

  const metadataFields = useMemo(() => metadataFieldsFor(draft.type), [draft.type])

  const setType = useCallback((type: RelationshipType) => {
    setDraft((d) => ({ ...d, type }))
    setViolations([])
  }, [])
  const setToId = useCallback((toId: string) => setDraft((d) => ({ ...d, toId })), [])
  const setStartDate = useCallback((startDate: string) => setDraft((d) => ({ ...d, startDate })), [])
  const setEndDate = useCallback((endDate: string) => setDraft((d) => ({ ...d, endDate })), [])
  const setMetadata = useCallback((key: string, value: string) => {
    setDraft((d) => ({ ...d, metadata: { ...d.metadata, [key]: value } }))
  }, [])

  const commit = useCallback(() => {
    if (entity == null || draft.toId === "") return
    const found = applyAuthorEdge(
      relationships,
      {
        fromId: entity.id,
        toId: draft.toId,
        type: draft.type,
        startDate: blankToNull(draft.startDate),
        endDate: blankToNull(draft.endDate),
        metadata: buildMetadata(draft.type, draft.metadata),
      },
      crypto.randomUUID(),
      entityIds,
      { setRelationships },
    )
    setViolations(found)
    // The draft survives a refusal: the analyst has to change something, and clearing the form
    // under them would make them retype the parts that were right.
    if (found.length === 0) setDraft((d) => ({ ...EMPTY_DRAFT, type: d.type }))
  }, [entity, draft, relationships, entityIds, setRelationships])

  const endDate = useCallback((edgeId: string, value: string | null) => {
    setViolations(applyEndDate(relationships, edgeId, value, entityIds, { setRelationships }))
  }, [relationships, entityIds, setRelationships])

  const remove = useCallback((edgeId: string) => {
    applyDeleteEdge(relationships, edgeId, { setRelationships })
    setViolations([])
  }, [relationships, setRelationships])

  return {
    entity,
    rows,
    draft,
    setType,
    setToId,
    setStartDate,
    setEndDate,
    setMetadata,
    definition: EDGE_TYPES[draft.type],
    metadataFields,
    targets,
    violations,
    canCommit: entity != null && draft.toId !== "",
    commit,
    endDate,
    remove,
  }
}

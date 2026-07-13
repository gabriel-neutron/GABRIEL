import type { Entity, PositionMode } from "@/core/entity/entity"
import type { Claim } from "@/core/provenance/claim"
import type { DrawnGeometry } from "@/types/domain.types"

/**
 * The entity-keyed slices a merge has to rewrite atomically. `mergeEntities` is pure —
 * it returns fresh arrays and never mutates its input — so the store can drop the result
 * into a single Zustand `set` (ADR 0005 atomicity).
 */
export type IdentityGraph = {
  entities: Entity[]
  claims: Claim[]
  geometries: DrawnGeometry[]
}

/**
 * Merges `secondaryId` into `primaryId`, collapsing two records for one real-world entity
 * into one **without losing data** (ADR 0006, E3 success criterion):
 *
 * - the primary keeps its id, name, kind, layer and symbol identity (`natoSymbolCode`);
 * - the secondary's name + aliases survive as the primary's `aliases`;
 * - any *informational* field the primary leaves empty is back-filled from the secondary,
 *   `parentId` included; `notes` are concatenated;
 * - `positionMode` becomes "own" if either record was, so a located secondary's geometry
 *   (moved to the primary) still renders instead of silently vanishing;
 * - the secondary's children are re-parented onto the primary (promoting the primary out of
 *   the secondary's subtree first, so a merge up the hierarchy can't form a cycle);
 * - the secondary's geometries and claims move to the primary (claims de-duplicated);
 * - the secondary entity is removed.
 *
 * Returns the input graph unchanged if either id is missing, the ids are equal, or the two
 * records are of different `kind` (a guard against cross-kind corruption — `proposeMatches`
 * never crosses kinds, but a caller could).
 */
export function mergeEntities(graph: IdentityGraph, primaryId: string, secondaryId: string): IdentityGraph {
  if (primaryId === secondaryId) return graph
  const primary = graph.entities.find((e) => e.id === primaryId)
  const secondary = graph.entities.find((e) => e.id === secondaryId)
  if (!primary || !secondary || primary.kind !== secondary.kind) return graph

  const merged = mergeFields(primary, secondary, graph.entities)

  const entities = graph.entities
    .filter((e) => e.id !== secondaryId)
    .map((e) => {
      if (e.id === primaryId) return merged
      // Re-parent the secondary's children onto the primary. `mergeFields` has already
      // promoted the primary out of the secondary's subtree, so this can't create a cycle.
      if (e.parentId === secondaryId) return { ...e, parentId: primaryId }
      return e
    })

  const geometries = graph.geometries.map((g) =>
    g.entityId === secondaryId ? { ...g, entityId: primaryId, layerId: merged.layerId } : g,
  )

  const claims = dedupeClaims(
    graph.claims.map((c) => (c.entityId === secondaryId ? { ...c, entityId: primaryId } : c)),
  )

  return { entities, claims, geometries }
}

/**
 * The primary wins on identity/layer/symbol; positioning reconciles with the moved geometry;
 * every other informational field back-fills from the secondary so nothing populated is dropped.
 */
function mergeFields(primary: Entity, secondary: Entity, allEntities: Entity[]): Entity {
  const primaryMode = primary.positionMode ?? "own"
  const secondaryMode = secondary.positionMode ?? "own"
  // The merged entity holds both records' geometry, so it is positioned by its own geometry
  // if EITHER record was — otherwise a located secondary's pin would vanish (its geometry
  // moves onto the primary but would render nowhere under a "none"/"parent" mode).
  const positionMode: PositionMode = primaryMode === "own" || secondaryMode === "own" ? "own" : primaryMode
  const isExactPosition =
    positionMode !== "own"
      ? false
      : primaryMode === "own"
        ? (primary.isExactPosition ?? false)
        : (secondary.isExactPosition ?? false)

  return {
    // Identity + layer: the primary wins outright.
    id: primary.id,
    name: primary.name,
    kind: primary.kind,
    layerId: primary.layerId,
    parentId: resolveParent(primary, secondary, allEntities),
    aliases: mergeAliases(primary, secondary),
    notes: mergeNotes(primary.notes, secondary.notes),
    positionMode,
    isExactPosition,
    // Symbol identity follows the primary: never inherit the secondary's stored SIDC, or the
    // survivor would render the secondary's symbol while showing the primary's type/echelon.
    natoSymbolCode: primary.natoSymbolCode,
    // Informational fields: keep the primary's value, else back-fill the secondary's.
    type: primary.type ?? secondary.type,
    echelon: primary.echelon ?? secondary.echelon,
    affiliation: primary.affiliation ?? secondary.affiliation,
    domain: primary.domain ?? secondary.domain,
    osmRelationId: primary.osmRelationId ?? secondary.osmRelationId,
    militaryUnitId: primary.militaryUnitId ?? secondary.militaryUnitId,
    analyzedAt: primary.analyzedAt ?? secondary.analyzedAt,
  }
}

/**
 * The merged primary's parent. Back-fills the secondary's placement when the primary has
 * none (no-data-loss), and — when the primary sits inside the secondary's subtree — promotes
 * the primary into the secondary's slot instead of keeping its own parent, which would become
 * a cycle once the secondary's children re-parent onto the primary.
 */
function resolveParent(primary: Entity, secondary: Entity, entities: Entity[]): string | null {
  let parentId = isDescendant(primary.id, secondary.id, entities)
    ? (secondary.parentId ?? null)
    : (primary.parentId ?? secondary.parentId ?? null)
  if (parentId === secondary.id) parentId = secondary.parentId ?? null // never point at the removed record
  if (parentId === primary.id) parentId = null // never self-parent
  return parentId
}

/** True if `descendantId` sits somewhere below `ancestorId` in the parent chain (cycle-safe). */
function isDescendant(descendantId: string, ancestorId: string, entities: Entity[]): boolean {
  const parentById = new Map(entities.map((e) => [e.id, e.parentId]))
  const seen = new Set<string>()
  let cur = parentById.get(descendantId) ?? null
  while (cur != null && !seen.has(cur)) {
    if (cur === ancestorId) return true
    seen.add(cur)
    cur = parentById.get(cur) ?? null
  }
  return false
}

/**
 * Union of the primary's aliases, the secondary's name, and the secondary's aliases —
 * de-duplicated by exact trimmed string, and dropping any that just restate the primary's
 * current name. `undefined` when the result is empty (keeps clean rows/diffs).
 */
function mergeAliases(primary: Entity, secondary: Entity): string[] | undefined {
  const result: string[] = []
  const seen = new Set<string>([primary.name.trim()])
  for (const raw of [...(primary.aliases ?? []), secondary.name, ...(secondary.aliases ?? [])]) {
    const value = raw.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result.length ? result : undefined
}

/** Concatenate distinct notes (primary first) so neither record's notes are lost. */
function mergeNotes(a: string | null | undefined, b: string | null | undefined): string | null | undefined {
  const parts = [a, b].map((n) => n?.trim()).filter((n): n is string => !!n)
  const distinct = [...new Set(parts)]
  return distinct.length ? distinct.join("\n\n") : (a ?? b)
}

/**
 * Follows a secondaryId -> primaryId merge chain (an id merged away, then merged away again)
 * to the surviving id. Returns `id` unchanged if it was never merged. Used to redirect work
 * keyed to a since-merged-away entity id (e.g. enrichment proposals) onto its survivor.
 */
export function resolveEntityId(mergeMap: Record<string, string>, id: string): string {
  let cur = id
  const seen = new Set<string>()
  while (mergeMap[cur] !== undefined && !seen.has(cur)) {
    seen.add(cur)
    cur = mergeMap[cur]
  }
  return cur
}

/**
 * Collapse claims that became exact duplicates once the secondary's claims moved to the
 * primary, keeping whichever survivor's `credibility`/`timestamp` is populated — an
 * analyst-assigned rating on either record must survive the merge, not just the one that
 * happened to appear first in array order.
 */
function dedupeClaims(claims: Claim[]): Claim[] {
  const byKey = new Map<string, Claim>()
  const order: string[] = []
  for (const c of claims) {
    const key = JSON.stringify([c.entityId, c.field, c.value ?? "", c.sourceId])
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, c)
      order.push(key)
      continue
    }
    byKey.set(key, {
      ...existing,
      credibility: existing.credibility ?? c.credibility,
      timestamp: existing.timestamp ?? c.timestamp,
    })
  }
  return order.map((key) => byKey.get(key) as Claim)
}

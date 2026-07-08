import type { Entity } from "@/core/entity/entity"
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
 * - the primary keeps its id, name, kind and layer;
 * - the secondary's name + aliases survive as the primary's `aliases`;
 * - any field the primary leaves empty is back-filled from the secondary; `notes` are concatenated;
 * - the secondary's children are re-parented onto the primary;
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

  const merged = mergeFields(primary, secondary)

  const entities = graph.entities
    .filter((e) => e.id !== secondaryId)
    .map((e) => {
      if (e.id === primaryId) return merged
      // Re-parent the secondary's children (and, defensively, anything the primary's own
      // promoted parent pointer might now dangle) onto the primary.
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

/** Primary wins on every set field; the secondary back-fills gaps so nothing populated is dropped. */
function mergeFields(primary: Entity, secondary: Entity): Entity {
  // parentId: if the primary was parented *to* the secondary, promote to the secondary's
  // parent to avoid a dangling/self reference once the secondary is gone.
  let parentId = primary.parentId
  if (parentId === secondary.id) parentId = secondary.parentId === primary.id ? null : secondary.parentId

  const merged: Entity = { ...secondary, ...definedOnly(primary) } as Entity
  merged.id = primary.id
  merged.name = primary.name
  merged.kind = primary.kind
  merged.layerId = primary.layerId
  merged.parentId = parentId
  merged.aliases = mergeAliases(primary, secondary)
  merged.notes = mergeNotes(primary.notes, secondary.notes)
  return merged
}

/** Own enumerable properties of `obj` whose value is neither `undefined` nor `null`. */
function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key]
    if (value !== undefined && value !== null) out[key] = value
  }
  return out
}

/**
 * Union of the primary's aliases, the secondary's name, and the secondary's aliases —
 * de-duplicated by normalized-ish exact string, and dropping any that just restate the
 * primary's current name. `undefined` when the result is empty (keeps clean rows/diffs).
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

/** Drop claims that became exact duplicates once the secondary's claims moved to the primary. */
function dedupeClaims(claims: Claim[]): Claim[] {
  const seen = new Set<string>()
  const result: Claim[] = []
  for (const c of claims) {
    const key = JSON.stringify([c.entityId, c.field, c.value ?? "", c.sourceId])
    if (seen.has(key)) continue
    seen.add(key)
    result.push(c)
  }
  return result
}

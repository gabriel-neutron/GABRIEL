import type { Entity, PositionMode } from "@/core/entity/entity"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { Claim } from "@/core/provenance/claim"
import type { Relationship } from "@/core/relationship/relationship"
import type { DrawnGeometry } from "@/types/domain.types"

/**
 * The entity-keyed slices a merge has to rewrite atomically. `mergeEntities` is pure —
 * it returns fresh arrays and never mutates its input — so the store can drop the result
 * into a single Zustand `set` (ADR 0005 atomicity).
 *
 * `relationships` belongs here because the hierarchy IS the edge set (ADR 0011): removing
 * a record without re-pointing the edges that name it would leave the survivor's parent
 * and children asserted against an id that no longer exists.
 */
export type IdentityGraph = {
  entities: Entity[]
  claims: Claim[]
  geometries: DrawnGeometry[]
  relationships: Relationship[]
}

/**
 * The rewritten graph plus the integrity events **this merge minted** — never the caller's
 * existing ledger, so a store appends rather than replaces. Kept out of `IdentityGraph`
 * deliberately: an integrity event is a durable finding *about* the merge, not one of the
 * entity-keyed slices the merge rewrites.
 */
export type MergeResult = IdentityGraph & {
  integrityEvents: IntegrityEvent[]
}

/**
 * Merges `secondaryId` into `primaryId`, collapsing two records for one real-world entity
 * into one **without losing data** (ADR 0006, E3 success criterion):
 *
 * - the primary keeps its id, name, kind, layer and symbol identity (`natoSymbolCode`);
 * - the secondary's name + aliases survive as the primary's `aliases`;
 * - any *informational* field the primary leaves empty is back-filled from the secondary;
 *   `notes` are concatenated;
 * - `positionMode` becomes "own" if either record was, so a located secondary's geometry
 *   (moved to the primary) still renders instead of silently vanishing;
 * - every edge naming the secondary is re-pointed at the primary, which is what carries the
 *   secondary's parent and children across (`rewriteEdges`);
 * - the secondary's geometries and claims move to the primary (claims de-duplicated);
 * - the secondary entity is removed.
 *
 * `now` is injected rather than read from a clock here: this function is pure, so its
 * integrity events are reproducible and a test can assert `createdAt` exactly.
 *
 * Returns the input graph's slices unchanged, and no events, if either id is missing, the
 * ids are equal, or the two records are of different `kind` (a guard against cross-kind
 * corruption — `proposeMatches` never crosses kinds, but a caller could).
 */
export function mergeEntities(
  graph: IdentityGraph,
  primaryId: string,
  secondaryId: string,
  now: string,
): MergeResult {
  if (primaryId === secondaryId) return { ...graph, integrityEvents: [] }
  const primary = graph.entities.find((e) => e.id === primaryId)
  const secondary = graph.entities.find((e) => e.id === secondaryId)
  if (!primary || !secondary || primary.kind !== secondary.kind) return { ...graph, integrityEvents: [] }

  const merged = mergeFields(primary, secondary)

  const entities = graph.entities
    .filter((e) => e.id !== secondaryId)
    .map((e) => (e.id === primaryId ? merged : e))

  const geometries = graph.geometries.map((g) =>
    g.entityId === secondaryId ? { ...g, entityId: primaryId, layerId: merged.layerId } : g,
  )

  const claims = dedupeClaims(
    graph.claims.map((c) => (c.entityId === secondaryId ? { ...c, entityId: primaryId } : c)),
  )

  const { relationships, integrityEvents } = rewriteEdges(graph.relationships, primary, secondary, now)

  return { entities, claims, geometries, relationships, integrityEvents }
}

/**
 * Re-points every endpoint naming the secondary at the primary, then handles the two things
 * that re-pointing can break.
 *
 * An edge that **became** a self-loop is dropped and recorded verbatim: it asserted something
 * between two records that turn out to be one entity, and no entity holds a relationship to
 * itself. Recorded rather than silently deleted because the event is then the only surviving
 * trace of an assertion a human made. A self-loop that arrived as one is left untouched — the
 * merge did not create it, and `validateRelationships` already reports it.
 *
 * An edge that **became** a duplicate of another collapses. Two edges that were already
 * identical before the merge are left alone: `activeParentMap` treats them as two separate
 * assertions, and quietly collapsing them here would be this function deciding they say the
 * same thing.
 *
 * A survivor left holding two active hierarchy-bearing edges is CONTESTED, and nothing here
 * elects a winner (Q40): `activeParentMap` leaves it unmapped and a human adjudicates. Two
 * parents inherited from two records is a real finding about the data, not a mess to tidy.
 * Merging a record into its own parent drops that edge as a self-loop; merging into a more
 * distant ancestor can leave a cycle, which `buildOrbat` already traverses cycle-safely and a
 * human unwinds — snapping one of its edges here would be the same forbidden election.
 */
function rewriteEdges(
  rels: Relationship[],
  primary: Entity,
  secondary: Entity,
  now: string,
): { relationships: Relationship[]; integrityEvents: IntegrityEvent[] } {
  const relationships: Relationship[] = []
  const integrityEvents: IntegrityEvent[] = []
  // key -> was the edge holding it re-pointed by this merge?
  const seen = new Map<string, boolean>()

  for (const rel of rels) {
    const repointed = rel.fromId === secondary.id || rel.toId === secondary.id
    const fromId = rel.fromId === secondary.id ? primary.id : rel.fromId
    const toId = rel.toId === secondary.id ? primary.id : rel.toId

    if (repointed && fromId === toId) {
      // Captured from `rel`, before the re-pointed endpoints are written anywhere.
      integrityEvents.push(droppedEdgeEvent(rel, primary, secondary, now))
      continue
    }

    const key = edgeKey(fromId, toId, rel)
    const priorRepointed = seen.get(key)
    if (priorRepointed !== undefined && (repointed || priorRepointed)) continue
    seen.set(key, repointed)
    relationships.push(repointed ? { ...rel, fromId, toId } : rel)
  }

  return { relationships, integrityEvents }
}

/**
 * Two edges are the same assertion when they say the same thing about the same pair, id
 * aside. Metadata entries are sorted so that key order in the bag cannot make one assertion
 * look like two; `exportOverride` is compared as raw JSON, which can only ever *under*-match
 * — the safe direction, since under-matching keeps both edges and over-matching would drop
 * an authorisation someone performed a two-person ceremony for.
 */
function edgeKey(fromId: string, toId: string, rel: Relationship): string {
  const metadata = Object.entries(rel.metadata ?? {}).sort()
  return JSON.stringify([
    fromId, toId, rel.type, rel.startDate, rel.endDate, metadata, rel.exportOverride ?? null,
  ])
}

/**
 * `detail` carries the dropped edge's original `(id, fromId, toId, type)` quadruple —
 * verbatim and unnormalised. This row is the only surviving record of the assertion, so it
 * must read as it was authored rather than as the merge would have rewritten it.
 *
 * The id is deterministic (the same dropped edge yields the same row) and the summary names
 * the entities rather than their ids, because an analyst reads this, not a log.
 */
function droppedEdgeEvent(rel: Relationship, primary: Entity, secondary: Entity, now: string): IntegrityEvent {
  return {
    id: "integrity:merge-dropped-edge:" + rel.id,
    kind: "merge-dropped-edge",
    createdAt: now,
    summary: "A recorded " + rel.type + " relationship was dropped when " + secondary.name +
      " was merged into " + primary.name + ": both of its endpoints are now the same entity.",
    detail: { id: rel.id, fromId: rel.fromId, toId: rel.toId, type: rel.type },
  }
}

/**
 * The primary wins on identity/layer/symbol; positioning reconciles with the moved geometry;
 * every other informational field back-fills from the secondary so nothing populated is dropped.
 */
function mergeFields(primary: Entity, secondary: Entity): Entity {
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
    // Carried through untouched, never computed here: `parentId` is derived from the edge set
    // on every load and on every edge commit (ADR 0011), so any value decided here would be
    // overwritten by the derivation. `rewriteEdges` is where this merge's hierarchy work happens.
    parentId: primary.parentId ?? null,
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

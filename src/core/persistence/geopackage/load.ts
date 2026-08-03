import { GeoPackageAPI, type GeoPackage } from "@ngageoint/geopackage"
import { readEntities, readLegacyUnitSourcesColumn } from "./units.table"
import { readOrganisations, organisationsToCorporateEntities, organisationSourcesMap } from "./organisations.table"
import { readLayers } from "./layers.table"
import { readGeometries } from "./geometries.table"
import { readSourceCache } from "./researchSources.table"
import { readProvenanceSources } from "./provenanceSources.table"
import { readProvenanceClaims } from "./provenanceClaims.table"
import { readRatingEvents } from "./ratingEvents.table"
import { readRelationships } from "./relationships.table"
import { readIntegrityEvents } from "./integrityEvents.table"
import { migrateHierarchyToRelationships } from "./migrateHierarchy"
import { validateRelationships, type RelationshipViolation } from "@/core/relationship/validate"
import { activeParentMap, withDerivedParents } from "@/core/relationship/activeParent"
import { deriveProvenanceFromEntities, type EntityLedgerInput } from "@/core/provenance/deriveFromEntities"
import type { Relationship } from "@/core/relationship/relationship"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { GeoPackageLoadResult, GpkgEntity } from "./types"

/** Deterministic, so a re-detected condition updates one row instead of accumulating rows —
 *  the same first-colon namespacing the migration event and the `hier:` edge ids use. */
const MULTIPLE_ACTIVE_PREFIX = "integrity:multiple-active-hierarchy:"
const CROSS_KIND_PREFIX = "integrity:cross-kind-parent:"

/** The two codes that make the file unopenable rather than merely flawed. Neither can survive
 *  as a finding: an edge whose endpoint is absent, or whose endpoints are the same entity,
 *  contradicts the entity set the loader has just validated, which is a schema problem. */
const FATAL_VIOLATION_CODES = new Set<string>(["dangling-endpoint", "self-loop"])

function quoted(value: string): string {
  return "\"" + value + "\""
}

/**
 * §7 step 4: `dangling-endpoint` and `self-loop` throw. The message carries the
 * `Unsupported schema` prefix the other throws in this file already use, so the catch below
 * lets it through unwrapped rather than re-diagnosing a specific, nameable defect as an
 * unreadable file.
 */
function throwOnFatalViolations(violations: readonly RelationshipViolation[]): void {
  const fatal = violations.filter((v) => FATAL_VIOLATION_CODES.has(v.code))
  if (fatal.length !== 0) {
    const named = fatal.map((v) => quoted(v.relationshipId) + " " + v.code + " (" + v.detail + ")")
    throw new Error("Unsupported schema: " + String(fatal.length) + " relationship(s) contradict the entity set: " + named.join("; ") + ".")
  }
}

/**
 * One event per contested CHILD, not per offending edge: the finding is "this entity has two
 * parents", which two edges assert jointly. The derivation below decides the same condition from
 * the same predicate (`activeParent.ts`), so the row and the derivation cannot disagree — a
 * contested child is absent from `parentById` (Q40) and named here.
 */
function multipleActiveHierarchyEvents(
  violations: readonly RelationshipViolation[],
  rels: readonly Relationship[],
  entities: readonly GpkgEntity[],
  now: string,
): IntegrityEvent[] {
  const relById = new Map(rels.map((rel) => [rel.id, rel]))
  const competingByChild = new Map<string, Relationship[]>()
  for (const violation of violations) {
    if (violation.code !== "multiple-active-hierarchy") continue
    const rel = relById.get(violation.relationshipId)
    if (rel == null) continue
    const competing = competingByChild.get(rel.fromId)
    if (competing == null) competingByChild.set(rel.fromId, [rel])
    else competing.push(rel)
  }

  const nameById = new Map(entities.map((e) => [e.id, e.name]))
  const label = (id: string): string => quoted(nameById.get(id) ?? id)

  const events: IntegrityEvent[] = []
  for (const [childId, competing] of competingByChild) {
    events.push({
      id: MULTIPLE_ACTIVE_PREFIX + childId,
      kind: "multiple-active-hierarchy",
      createdAt: now,
      summary: label(childId) + " is placed under " + String(competing.length) +
        " parents at once (" + competing.map((rel) => label(rel.toId)).join(", ") +
        "), so it is left without a derived parent until a person records which is correct.",
      detail: { childId, relationshipIds: competing.map((rel) => rel.id), parentIds: competing.map((rel) => rel.toId) },
    })
  }
  return events
}

/**
 * T10. `Relationship` places no restriction on the kinds of its endpoints, but the entity
 * validation above throws when a `parentId` does not resolve within its own kind — so a
 * cross-kind hierarchy-bearing edge would derive a parent that makes the NEXT load throw.
 * The pair leaves the derivation by OMISSION (T15: a dangling parent is never written) and is
 * recorded instead. Nothing throws: the edge itself is a legitimate record, and throwing would
 * make a legitimate record unopenable.
 *
 * Mutates the map it is handed — the one the derivation built moments ago for this load, that
 * nobody else holds. Deleting during iteration is safe: each entry is examined once, and one
 * removed before it is reached is simply never visited.
 */
function crossKindParentEvents(
  parentById: Map<string, string>,
  entities: readonly GpkgEntity[],
  now: string,
): IntegrityEvent[] {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const events: IntegrityEvent[] = []
  for (const [childId, parentId] of parentById) {
    const child = byId.get(childId)
    const parent = byId.get(parentId)
    // A parent outside the entity set is T15's case and not this one: the derivation already
    // omits it by the same rule, and there is no second kind to compare against.
    if (child == null || parent == null) continue
    if (child.kind === parent.kind) continue
    parentById.delete(childId)
    events.push({
      id: CROSS_KIND_PREFIX + childId,
      kind: "cross-kind-parent",
      createdAt: now,
      summary: quoted(child.name) + " (" + child.kind + ") is recorded under " +
        quoted(parent.name) + " (" + parent.kind + "), which crosses entity kinds, so no " +
        "parent is derived for it and the relationship is kept exactly as recorded.",
      detail: { childId, childKind: child.kind, parentId, parentKind: parent.kind },
    })
  }
  return events
}

/**
 * Q2B-7. Six non-throwing violation codes — `unknown-type`, `date-order`, `invalid-date`,
 * `missing-required-date`, `invalid-metadata`, `invalid-export-override` — have no
 * `IntegrityEventKind` to be recorded under, and that union is locked at four members. They
 * are neither discarded in silence nor filed under a kind that would misname them; they are
 * surfaced here and the question is recorded in `docs/timelines/SLICE_2B_OPEN_QUESTIONS.md`.
 * Not a throw: none of the six contradicts the entity set, and every edge is still returned
 * exactly as it was recorded.
 */
function warnUnrecordableViolations(violations: readonly RelationshipViolation[]): void {
  const unrecordable = violations.filter(
    (v) => !FATAL_VIOLATION_CODES.has(v.code) && v.code !== "multiple-active-hierarchy",
  )
  if (unrecordable.length !== 0) {
    const preamble = "loadGeoPackage: " + String(unrecordable.length) + " relationship violation(s)"
    console.warn(preamble + " have no IntegrityEventKind to record them (Q2B-7):", unrecordable)
  }
}

/**
 * Event ids are deterministic, so a re-detected condition is the same row and not a new one.
 * The PERSISTED copy wins a collision: it may carry an acknowledgement an analyst typed, which
 * the freshly minted duplicate does not, so replacing it would erase the acknowledgement. It is
 * also what keeps two rows with one id out of `writeIntegrityEvents`, whose insert would fail
 * on the PRIMARY KEY. (Q2B-8b.)
 */
function mergeIntegrityEvents(
  persisted: readonly IntegrityEvent[],
  minted: readonly IntegrityEvent[],
): IntegrityEvent[] {
  const seen = new Set(persisted.map((event) => event.id))
  const merged = [...persisted]
  for (const event of minted) {
    if (seen.has(event.id)) continue
    seen.add(event.id)
    merged.push(event)
  }
  return merged
}

export async function loadGeoPackage(buffer: ArrayBuffer): Promise<GeoPackageLoadResult> {
  let geoPackage: GeoPackage | null = null
  try {
    geoPackage = await GeoPackageAPI.open(new Uint8Array(buffer))

    const layers = readLayers(geoPackage)
    // Legacy organisations (pre-E1 files) fold into the same unified entities array,
    // tagged kind: "corporate" — see organisations.table.ts's migrateLegacyOrganisations.
    // Read once and reused for both the entity mapping and the legacy sources map below
    // (rather than calling migrateLegacyOrganisations + readLegacyOrganisationSources
    // separately, which would scan/decode the same table twice on every load).
    const unitEntities = readEntities(geoPackage)
    const legacyOrganisations = readOrganisations(geoPackage)
    const corporateEntities = organisationsToCorporateEntities(legacyOrganisations)
    const entities = [...unitEntities, ...corporateEntities]
    // §7 step 1. Read here, before the validation and the migration, because only this read
    // can tell the migration gate below what it is allowed to gate on: `readRelationships`
    // returns null for an ABSENT table and [] for an empty one (T11).
    const persisted = readRelationships(geoPackage)
    const persistedEvents = readIntegrityEvents(geoPackage)
    const geometries = await readGeometries(geoPackage)
    const sourceCache = readSourceCache(geoPackage)
    // ADR 0006, E2.6: entity.sources no longer exists — derive from the legacy raw
    // sources columns on both units and organisations (the only two places a
    // pre-cutover file could have stored citations), merged with whatever provenance
    // was already persisted from a prior save. Kept as two separate lookups rather
    // than one merged Map: units and legacy organisations are independent tables with
    // independently-assigned ids, and merging into one Map would silently drop one
    // table's citation string on an (unenforced, if unlikely) id collision.
    const unitLegacySources = readLegacyUnitSourcesColumn(geoPackage)
    const organisationLegacySources = organisationSourcesMap(legacyOrganisations)
    const ledgerInputs: EntityLedgerInput[] = [
      ...unitEntities.map((e) => ({ id: e.id, sources: unitLegacySources.get(e.id) ?? null })),
      ...corporateEntities.map((e) => ({ id: e.id, sources: organisationLegacySources.get(e.id) ?? null })),
    ]
    const { sources, claims } = deriveProvenanceFromEntities(
      ledgerInputs,
      readProvenanceSources(geoPackage),
      readProvenanceClaims(geoPackage),
    )

    const layerIds = new Set(layers.map((l) => l.id))
    const entityIds = new Set(entities.map((e) => e.id))
    // Units and corporate entities form separate hierarchies — a parentId is only
    // valid within its own kind, so validate against a same-kind id set, not the
    // pooled one (which would silently accept a cross-kind parent reference).
    const unitIds = new Set(entities.filter((e) => e.kind === "unit").map((e) => e.id))
    const corporateIds = new Set(entities.filter((e) => e.kind === "corporate").map((e) => e.id))
    for (const e of entities) {
      if (!layerIds.has(e.layerId)) {
        throw new Error("Unsupported schema: entity references missing layer.")
      }
      if (e.parentId != null) {
        const sameKindIds = e.kind === "corporate" ? corporateIds : unitIds
        if (!sameKindIds.has(e.parentId)) {
          throw new Error("Unsupported schema: entity references missing parent.")
        }
      }
    }
    for (const g of geometries) {
      if (!layerIds.has(g.layerId)) {
        throw new Error("Unsupported schema: geometry references missing layer.")
      }
      if (g.entityId != null && !entityIds.has(g.entityId)) {
        throw new Error("Unsupported schema: geometry references missing entity.")
      }
    }

    // Q2B-8a: `loadGeoPackage` takes no clock, so the timestamp is read here and read ONCE,
    // so every event this load mints shares one instant. `migrateHierarchyToRelationships`
    // keeps its injected `now` and stays pure and reproducible.
    const now = new Date().toISOString()
    // §7 step 3, T11. Gated on the relationships TABLE being absent, never on a row count:
    // deterministic `hier:` ids stop duplication but not resurrection, and after the first
    // save `parent_id` holds the derivation rather than original data, so a second run would
    // bring back an edge an analyst deleted. It consumes the RAW `parentId` values — which
    // the loop above has just proved resolve within their own kind, so no minted edge can
    // carry a dangling endpoint or a self-loop — and it runs before any derivation, or it
    // would mint from its own output.
    let relationships: Relationship[]
    let minted: IntegrityEvent[]
    if (persisted === null) {
      const migration = migrateHierarchyToRelationships(entities, [], now)
      relationships = migration.relationships
      minted = migration.integrityEvents
    } else {
      relationships = persisted
      minted = []
    }

    // §7 step 4, after the migration, which is what gets the minted edges validated at all.
    const violations = validateRelationships(relationships, entityIds)
    throwOnFatalViolations(violations)
    minted.push(...multipleActiveHierarchyEvents(violations, relationships, entities, now))
    warnUnrecordableViolations(violations)

    const ratingEvents = readRatingEvents(geoPackage)

    // §7 step 5, last: the edge set is the sole authority for `parentId` once it is derived.
    // Never in place — the migration above needed the raw values, so this produces new
    // entity objects and leaves `entities` untouched.
    const derived = activeParentMap(relationships)
    const crossKindEvents = crossKindParentEvents(derived.parentById, entities, now)
    const derivedEntities = withDerivedParents(entities, derived)

    return {
      layers,
      entities: derivedEntities,
      geometries,
      sourceCache,
      sources,
      claims,
      ratingEvents,
      relationships,
      integrityEvents: mergeIntegrityEvents(persistedEvents, [...minted, ...crossKindEvents]),
    }
  } catch (e) {
    // T13: a migration failure is a specific, nameable defect on a healthy file. Re-wrapping it
    // as corruption would give the analyst a false diagnosis at the worst possible moment.
    if (e instanceof Error && (e.message.startsWith("Unsupported schema") || e.message.startsWith("Hierarchy migration"))) throw e
    const errorMsg = e instanceof Error ? e.message : String(e)
    console.error("loadGeoPackage: parse error", errorMsg, e instanceof Error ? e.stack : undefined)
    throw new Error(`Corrupted GeoPackage or unsupported schema: ${errorMsg}`)
  } finally {
    if (geoPackage) geoPackage.close()
  }
}

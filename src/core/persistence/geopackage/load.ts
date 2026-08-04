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
import { withContestedParentEvents } from "@/core/integrity/contestedParentEvents"
import {
  crossKindParentEvents,
  relationshipViolationEvents,
  stalePersistedParentEvents,
} from "@/core/integrity/mintOnLoad"
import type { GeoPackageLoadResult } from "./types"

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

    // Q2B-8a: `loadGeoPackage` takes no clock, so the timestamp is read here and read ONCE, so
    // every event this load mints or rehabilitates shares one instant. `migrateHierarchyToRelationships`
    // keeps its injected `now` and stays pure and reproducible.
    const now = new Date().toISOString()
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
    const persistedEvents = readIntegrityEvents(geoPackage, now)
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
    // The parent check throws only on a file that has NOT been migrated. There, the raw
    // `parent_id` values are the record and `migrateHierarchyToRelationships` is about to mint
    // an edge from each, so an unresolvable one would become an edge with a dangling endpoint —
    // a fatal violation, discovered later and diagnosed worse. Once `relationships` exists the
    // same column is a derivation that `withDerivedParents` overwrites below, and its only
    // surviving effect is the ability to make the analyst's project unopenable. It is recorded
    // instead, by the policy `crossKindParentEvents` already established for the mirror case.
    const stalePersistedParents: typeof entities = []
    for (const e of entities) {
      if (!layerIds.has(e.layerId)) {
        throw new Error("Unsupported schema: entity references missing layer.")
      }
      if (e.parentId == null) continue
      const sameKindIds = e.kind === "corporate" ? corporateIds : unitIds
      if (sameKindIds.has(e.parentId)) continue
      if (persisted === null) {
        throw new Error("Unsupported schema: entity references missing parent.")
      }
      stalePersistedParents.push(e)
    }
    for (const g of geometries) {
      if (!layerIds.has(g.layerId)) {
        throw new Error("Unsupported schema: geometry references missing layer.")
      }
      if (g.entityId != null && !entityIds.has(g.entityId)) {
        throw new Error("Unsupported schema: geometry references missing entity.")
      }
    }

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
    // Six of the nine codes become durable rows here rather than a console warning (owner
    // ruling, 2026-08-03, superseding Q2B-7's stopgap): a log is not a record, and nothing an
    // analyst can acknowledge lives in one. The seventh, multiple-active-hierarchy, is minted
    // below from the derivation that decides it rather than from a second pass over these
    // violations (Slice 3); the last two are fatal and threw above.
    minted.push(...relationshipViolationEvents(violations, relationships, entities, now))
    minted.push(...stalePersistedParentEvents(stalePersistedParents, entities, now))

    const ratingEvents = readRatingEvents(geoPackage)

    // §7 step 5, last: the edge set is the sole authority for `parentId` once it is derived.
    // Never in place — the migration above needed the raw values, so this produces new
    // entity objects and leaves `entities` untouched.
    // The entities, not just their ids: without the kinds the derivation cannot see a
    // cross-kind pair, and would place a child under a parent ADR 0011 says must derive
    // nothing — which is what every consumer reading the index would then render.
    const derived = activeParentMap(relationships, { entities })
    const crossKindEvents = crossKindParentEvents(derived.unresolvable, entities, now)
    const derivedEntities = withDerivedParents(entities, derived)
    // The contests this derivation has just decided, through the one minter the edit path uses
    // too. An empty ledger is passed rather than the persisted one because `mergeIntegrityEvents`
    // below already gives the persisted row precedence — it may carry an acknowledgement that a
    // freshly minted copy cannot.
    minted.push(...withContestedParentEvents([], derived.contested, relationships, entities, now))

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

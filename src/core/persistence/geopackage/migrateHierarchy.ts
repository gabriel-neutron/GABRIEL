import type { EntityKind } from "@/core/entity/entity"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { Relationship } from "@/core/relationship/relationship"

/**
 * One-shot migration of the legacy `parent_id` column into first-class edges
 * (ADR 0011 — relationships are the hierarchy). Pure: it reads entity ids,
 * kinds and parents, and nothing else.
 *
 * The caller gates it on the ABSENCE of the `relationships` table, never on id
 * uniqueness or row count (Trap T11): after the first save `parent_id` holds the
 * derivation rather than original data, so a second run would not duplicate an
 * edge — it would resurrect one an analyst had replaced.
 */

/** Deterministic and reversible on a first-colon split; no entity id contains `:`. */
const HIERARCHY_ID_PREFIX = "hier:"

/** Deterministic, so a re-run updates one row instead of accumulating rows. */
const MIGRATION_EVENT_ID = "integrity:hierarchy-migrated"

/** The complete set of types this module can emit. Two elements, written as a
 *  literal union rather than a lookup or a configurable list, so the vocabulary's
 *  single assessment-tier type is unreachable from here by any path, including
 *  configuration (Trap T12): a machine-minted assessment edge would launder an
 *  analytical judgement into a documentary record (ADR 0010), and no machine-minted
 *  edge can carry the two-person `ExportOverride` (ADR 0009). */
type MintableType = "subordinate_to" | "corporate_parent"

const ROSTEC = "23dfd3ce-6465-55ca-83d4-cc8c766d8444" // Rostec State Corporation
const NPK_TECHMASH = "b4f1f1cf-1791-58de-b761-f65842e9d202" // NPK Techmash JSC

/** The source sentence for KAMAZ, frozen. `49.9`, never `50`: `c.` is a precision
 *  qualifier and 49.9 is already the approximation, so rounding up would cross the
 *  control threshold and invert the analytical meaning. */
const KAMAZ_SOURCE_SENTENCE = "... Rostec holds c.49.9% share."

/** The source sentence for Kalashnikov, frozen. `25`, never `25.000001`: fabricating
 *  a value to encode the "+1" would invent unsourced data in a published field. The
 *  "+1 share" and "private majority" are a legal effect, not a quantity; their home is
 *  a Claim attached to the edge (Slice 6). Omitting the number is the greater danger —
 *  the published CC-BY definition reads a bare edge as "no ownership share
 *  established", i.e. as MORE control than 25%, against a source that denies it. */
const KALASHNIKOV_SOURCE_SENTENCE = "Rostec holds 25%+1 share; private majority."

/** The 13 legacy corporate links, hand-classified row by row from `organisations`
 *  and verified against the real file on 2026-07-29. Keyed by CHILD entity id.
 *
 *  THE MIGRATION NEVER READS `notes`. Both percentages are frozen literals here,
 *  with the source sentence beside them, so the classification is reviewable in a
 *  diff rather than inferred at runtime (GABRIEL_V2_SLICE_0_1_BUILD.md:519-521).
 *  See Trap T12 for why a parser is forbidden and not merely discouraged: the
 *  Kalashnikov note carries two percentages and the first one, 95%, is a MARKET
 *  share, so the obvious pattern publishes "Rostec holds 95% of Kalashnikov" —
 *  false and defamatory. A parser is also permanent: it would re-run over prose an
 *  analyst edits later, never knowing it is being read.
 *
 *  Keyed on ids, never on labels — the parent's real name is
 *  `Rostec State Corporation`, not the `Rostec` the docs abbreviate. */
export const LEGACY_CORPORATE_LINKS: Readonly<
  Record<string, { readonly parentId: string; readonly percent?: number }>
> = {
  "74212d89-d123-5e04-8e7e-f817483c6b1d": { parentId: ROSTEC }, // United Aircraft Corporation (UAC) PJSC
  "95a79d63-c7d6-5cdf-b415-23499d444448": { parentId: ROSTEC }, // Russian Helicopters JSC
  "d3708808-9a6b-54cb-94b7-ecef7315efb8": { parentId: ROSTEC }, // United Engine Corporation JSC (UEC)
  "d2f659b0-7f66-5c14-8081-39f48737145f": { parentId: ROSTEC }, // High Precision Systems JSC
  "e667a62a-386a-548a-a8e2-9989616ab7a0": { parentId: ROSTEC }, // JSC Concern Radio-Electronic Technologies (KRET)
  "f0be4fd5-018d-5413-a8fb-93ad47643ac9": { parentId: ROSTEC }, // JSC Ruselectronics
  "02b83897-e746-500c-a4da-48a9be042986": { parentId: ROSTEC }, // Shvabe Holding
  "b4f1f1cf-1791-58de-b761-f65842e9d202": { parentId: ROSTEC }, // NPK Techmash JSC — itself a parent, see Motovilikha
  // KAMAZ PTC. Frozen source sentence: "... Rostec holds c.49.9% share."
  "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39": { parentId: ROSTEC, percent: 49.9 },
  // JSC Kalashnikov Concern. Frozen source sentence:
  // "Rostec holds 25%+1 share; private majority."
  "d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c": { parentId: ROSTEC, percent: 25 },
  "2b57b3fb-4fdb-593c-bab4-28bad2214670": { parentId: ROSTEC }, // Uralvagonzavod JSC (UVZ)
  // PJSC Motovilikha Plants — the only two-level chain: Motovilikha -> Techmash -> Rostec.
  "f727b211-b3f4-525c-9776-07192c0d2e80": { parentId: NPK_TECHMASH },
  "ac8c1602-9c56-5615-b08c-10e67cb93a05": { parentId: ROSTEC }, // JSC Rosoboronexport
}

/** Built once from the frozen table. A Map rather than index access on the record,
 *  so a child id can never collide with an inherited object property, and so the
 *  lookup is a `!= null` test rather than a key-presence test (Trap T6). */
const CORPORATE_BY_CHILD = new Map(Object.entries(LEGACY_CORPORATE_LINKS))

export type HierarchyMigrationResult = {
  /** Existing edges plus newly minted ones. Never mutates the input. */
  relationships: Relationship[]
  integrityEvents: IntegrityEvent[]
  mintedEdges: number
  skippedAlreadyPresent: number
  entitiesWithParentId: number
}

/** `percent: 0` is a legal recorded value meaning zero percent, so absence is tested
 *  with `!= null` and never defaulted to `0` — the two are different statements. */
function mintEdge(
  childId: string,
  parentId: string,
  type: MintableType,
  percent?: number,
): Relationship {
  return {
    id: HIERARCHY_ID_PREFIX + childId,
    fromId: childId,
    toId: parentId,
    type,
    startDate: null,
    endDate: null,
    metadata: percent == null ? {} : { percent },
  }
}

/**
 * Trap T13: the message begins with exactly `Hierarchy migration` because
 * `load.ts` re-wraps anything it does not recognise as
 * `Corrupted GeoPackage or unsupported schema: ...`. Telling an analyst their
 * healthy file is corrupt is a false diagnosis at the worst possible moment.
 *
 * The reachable cause is a duplicate child id in the entity set: the second
 * occurrence can be neither minted (its edge id is taken) nor counted as already
 * present, so it shows up here by name rather than silently losing an edge.
 */
function assertEveryParentAccountedFor(
  entitiesWithParentId: number,
  mintedEdges: number,
  skippedAlreadyPresent: number,
  unaccounted: readonly string[],
): void {
  if (entitiesWithParentId === mintedEdges + skippedAlreadyPresent) return
  const deficit = entitiesWithParentId - mintedEdges - skippedAlreadyPresent
  throw new Error(
    "Hierarchy migration accounted for " + String(mintedEdges + skippedAlreadyPresent) +
    " of " + String(entitiesWithParentId) + " entities with a parent (minted " +
    String(mintedEdges) + ", skipped " + String(skippedAlreadyPresent) +
    " already present, deficit " + String(deficit) + "). Unaccounted children: " +
    (unaccounted.length === 0 ? "none identified" : unaccounted.join(", ")) + ".",
  )
}

/** One sentence, publishable, naming entities rather than ids: this row is a record
 *  an analyst reads, not a log line. The percentage clause appears only when both
 *  priced edges were minted, so the sentence never claims a holding this run did not
 *  record. Both figures are frozen here, exactly as in the table above. */
function migrationSummary(
  mintedEdges: number,
  corporateEdges: number,
  pricedEdges: number,
): string {
  const holdings = pricedEdges < 2
    ? "."
    : ", including Rostec State Corporation's c.49.9% share of KAMAZ PTC and its " +
      "25% share of JSC Kalashnikov Concern."
  return "The " + String(mintedEdges) +
    " parent-child links carried in this project's legacy parent column are now " +
    "recorded as typed relationships: " + String(mintedEdges - corporateEdges) +
    " unit subordinations and " + String(corporateEdges) + " corporate parent holdings" +
    holdings
}

/** The two source sentences travel into the file itself, verbatim, so the derivation
 *  of the only two published percentages is auditable inside the GeoPackage rather
 *  than only in a commit message. Recorded for both rows whether or not this
 *  particular run minted them: they are the provenance of the frozen table. */
function migrationEvent(
  now: string,
  summary: string,
  detail: Record<string, unknown>,
): IntegrityEvent {
  return {
    id: MIGRATION_EVENT_ID,
    kind: "hierarchy-migrated",
    createdAt: now,
    summary,
    detail: {
      ...detail,
      percentSources: [
        {
          childId: "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39",
          child: "KAMAZ PTC",
          parent: "Rostec State Corporation",
          percent: 49.9,
          sourceSentence: KAMAZ_SOURCE_SENTENCE,
        },
        {
          childId: "d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c",
          child: "JSC Kalashnikov Concern",
          parent: "Rostec State Corporation",
          percent: 25,
          sourceSentence: KALASHNIKOV_SOURCE_SENTENCE,
        },
      ],
    },
  }
}

/**
 * Pure. `now` is injected — no clock inside, so the result is reproducible and the
 * test can assert `createdAt` exactly.
 *
 * Two rules, and there is no third. A child id in `LEGACY_CORPORATE_LINKS` mints
 * `corporate_parent` with its parent and percentage taken from that table and from
 * nowhere else; every other entity with a non-null `parentId` mints `subordinate_to`.
 * No `attachment` is stamped: absent attachment counts as organic (owner Ruling 2),
 * which is what puts the unit links under the dual-subordination gate.
 *
 * Idempotent at the function level: passing a previous result's `relationships` back
 * in as `existing` mints nothing and counts every entity as already present.
 */
export function migrateHierarchyToRelationships(
  entities: readonly { id: string; kind: EntityKind; parentId: string | null }[],
  existing: readonly Relationship[],
  now: string,
): HierarchyMigrationResult {
  const existingIds = new Set(existing.map((rel) => rel.id))
  const seenChildIds = new Set<string>()
  const unaccounted: string[] = []
  const minted: Relationship[] = []
  let entitiesWithParentId = 0
  let skippedAlreadyPresent = 0
  let corporateEdges = 0
  let pricedEdges = 0

  for (const entity of entities) {
    if (entity.parentId == null) continue
    entitiesWithParentId += 1

    // A repeated child id would mint a second edge under an id already taken, so it
    // is reported by name below instead of overwriting or silently vanishing.
    if (seenChildIds.has(entity.id)) {
      unaccounted.push(entity.id)
      continue
    }
    seenChildIds.add(entity.id)

    if (existingIds.has(HIERARCHY_ID_PREFIX + entity.id)) {
      skippedAlreadyPresent += 1
      continue
    }

    const corporate = CORPORATE_BY_CHILD.get(entity.id)
    if (corporate == null) {
      minted.push(mintEdge(entity.id, entity.parentId, "subordinate_to"))
      continue
    }
    minted.push(mintEdge(entity.id, corporate.parentId, "corporate_parent", corporate.percent))
    corporateEdges += 1
    if (corporate.percent != null) pricedEdges += 1
  }

  assertEveryParentAccountedFor(
    entitiesWithParentId, minted.length, skippedAlreadyPresent, unaccounted,
  )

  // No edges minted means no migration happened, and an event recording a migration
  // that did not happen is not a record of anything (see Q2B-3).
  const integrityEvents = minted.length === 0 ? [] : [migrationEvent(
    now,
    migrationSummary(minted.length, corporateEdges, pricedEdges),
    {
      entitiesWithParentId,
      mintedEdges: minted.length,
      skippedAlreadyPresent,
      corporateParentEdges: corporateEdges,
      subordinateToEdges: minted.length - corporateEdges,
    },
  )]

  return {
    relationships: [...existing, ...minted],
    integrityEvents,
    mintedEdges: minted.length,
    skippedAlreadyPresent,
    entitiesWithParentId,
  }
}

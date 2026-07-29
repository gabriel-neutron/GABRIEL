import type { OrganisationType } from "@/types/organisation.types"
import type { ExternalId } from "./externalId"

export type PositionMode = "own" | "parent" | "none"

/**
 * Fields every Entity carries regardless of Profile (ADR 0004): identity,
 * hierarchy placement, Provenance Ledger, and position. Profile-specific
 * fields live in a `Profile` member (e.g. `UnitProfile`), never here —
 * `core/entity` must not import any one profile's field set.
 */
export type EntityCore = {
  id: string
  name: string
  /** Required: every entity sits on a layer. New geometry uses `getDefaultEntityLayerId` when picking a layer. */
  layerId: string
  parentId: string | null
  /**
   * Alternate names this entity is also known by (ADR 0006 / E3 `core/identity`).
   * Populated when two records for one real-world entity are merged: the losing
   * record's name and aliases survive here rather than being discarded, and they
   * feed later duplicate detection (`proposeMatches`). Also the home for
   * Latin↔Cyrillic alias spellings. Absent/`[]` means "no known aliases".
   */
  aliases?: string[]
  /**
   * Registry and sanctions-list identifiers this entity is known by (ADR 0010,
   * Slice 1): an IMO number, an INN, an LEI, an OFAC SDN id. Unlike aliases,
   * these are exact-match keys — they are what lets a record here be tied to a
   * row in an external register without relying on a name. Absent means "no
   * recorded external ids", and an empty array is persisted as absent.
   */
  externalIds?: ExternalId[]
  /** Free-form notes. */
  notes?: string | null
  /** ISO timestamp of the latest completed batch analysis for this entity. */
  analyzedAt?: string | null
  /** How the entity is positioned: own geometry, linked to parent, or unknown. Defaults to "own". */
  positionMode?: PositionMode
  /** Whether the entity position is considered exact. Defaults to false. */
  isExactPosition?: boolean
}

/**
 * The military Unit Profile (ADR 0004). `kind` is a persisted GeoPackage
 * column (`core/persistence/geopackage/units.table.ts`) — every row predating
 * this column defaults to `"unit"`, since that's all the `units` table ever held.
 */
export type UnitProfile = {
  kind: "unit"
  /** Unit type for symbol derivation (e.g. infantry, armored, artillery). */
  type?: string
  /** Stored 20-digit SIDC when present; otherwise derived from type/echelon. */
  natoSymbolCode?: string | null
  /** Echelon for symbol amplifier (e.g. Division, Regiment). */
  echelon?: string
  /** Affiliation for frame (Friend, Hostile, etc.). */
  affiliation?: "Friend" | "Hostile" | "Neutral" | "Unknown" | "Assumed Friend" | "Suspect"
  /** Battle dimension (default Ground). */
  domain?: "Ground" | "Air" | "Sea" | "Subsurface" | "Space"
  /** OSM relation id (e.g. multipolygon for military base). */
  osmRelationId?: number | null
  /** Military unit identifier (MUN)*/
  militaryUnitId?: string | null
}

/**
 * The Corporate Profile (ADR 0004's E1 pilot — the collapsed `Organisation`).
 * Always sits on the fixed synthetic `INDUSTRY_LAYER_ID` layer, never an
 * arbitrary one (unlike `UnitProfile`, which can sit on any layer).
 */
export type CorporateProfile = {
  kind: "corporate"
  type: OrganisationType
  /** OSM relation id (e.g. multipolygon for an industrial site). */
  osmRelationId?: number | null
}

/**
 * Vessel, Person and Equipment Class profiles (ADR 0010). Intentionally bare —
 * each carries the discriminant and nothing else. Entity below is a
 * hand-mirrored flattening, not an intersection with Profile, so a field added
 * here would not be readable on Entity without editing that mirror too. Keeping
 * these three empty is what lets the mirror stay untouched in this slice. Their
 * real field sets, and the matching mirror edits, land in Slice 5.
 */
export type VesselProfile = { kind: "vessel" }
export type PersonProfile = { kind: "person" }
export type EquipmentClassProfile = { kind: "equipment_class" }

/**
 * Flat tagged union of every Entity profile, discriminated by `kind` (ADR 0004
 * — flat, never nested: `entity.echelon`, not `entity.profile.echelon`). Future
 * profiles arrive bare (ADR 0010): the discriminant only, so that the Entity
 * field mirror below stays untouched until Slice 5 gives them field sets.
 */
export type Profile =
  | UnitProfile
  | CorporateProfile
  | VesselProfile
  | PersonProfile
  | EquipmentClassProfile

/**
 * Runtime companion to the Profile discriminant, in declaration order. Anything
 * validating a persisted or externally supplied kind checks this allowlist
 * instead of re-deriving the union by hand — a hand-written check silently
 * falls behind the day the union widens, and still typechecks.
 */
export const ENTITY_KINDS = ["unit", "corporate", "vessel", "person", "equipment_class"] as const
export type EntityKind = typeof ENTITY_KINDS[number]

/**
 * A sourced, source-rated, geolocated, hierarchable node — core + a flat
 * Profile (ADR 0004). Deliberately **not** a strict discriminated union at
 * this type: every profile-specific field is optional regardless of `kind`
 * ("D1-loose", see ROADMAP.md E1 note) so the ~15 direct `entity.echelon`-style
 * reads across the orbat module keep compiling without narrowing on `kind`
 * first. Narrow on `entity.kind` directly wherever exhaustive, kind-safe field
 * access is actually required (persistence encode/decode, symbol rendering,
 * the Corporate Profile's required `type`).
 */
export type Entity = EntityCore & {
  kind: Profile["kind"]
  /**
   * Widened to plain `string` rather than `UnitProfile["type"] & CorporateProfile["type"]`:
   * TypeScript intersects same-named properties across an intersection type, which would
   * otherwise narrow this to `OrganisationType` only and reject free-form unit type keys
   * (e.g. "infantry"). `OrganisationType` is already a subtype of `string`, so nothing is lost.
   */
  type?: string
  natoSymbolCode?: string | null
  echelon?: string
  affiliation?: UnitProfile["affiliation"]
  domain?: UnitProfile["domain"]
  osmRelationId?: number | null
  militaryUnitId?: string | null
}

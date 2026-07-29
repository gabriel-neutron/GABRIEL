import { EXTERNAL_ID_SCHEMES, type ExternalId, type ExternalIdScheme } from "@/core/entity/externalId"
import type { Layer, PositionMode } from "@/types/domain.types"
import { ORGANISATION_TYPES, type OrganisationType } from "@/types/organisation.types"

const VALID_POSITION_MODES = new Set<PositionMode>(["own", "parent", "none"])

export function decodePositionMode(raw: unknown): PositionMode {
  return typeof raw === "string" && VALID_POSITION_MODES.has(raw as PositionMode) ? (raw as PositionMode) : "own"
}

const VALID_ORGANISATION_TYPES = new Set<OrganisationType>(ORGANISATION_TYPES)

export function decodeOrganisationType(raw: unknown): OrganisationType {
  return typeof raw === "string" && VALID_ORGANISATION_TYPES.has(raw as OrganisationType)
    ? (raw as OrganisationType)
    : "other"
}

/**
 * Decodes the JSON-encoded `aliases` column (ADR 0006 / E3). A missing, non-JSON, or
 * wrong-shaped value decodes to `undefined` (never throws) — only an array of non-empty
 * strings survives, mirroring the defaulting other decoders use for corrupt/future data.
 */
export function decodeAliases(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const aliases = parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    return aliases.length ? aliases : undefined
  } catch {
    return undefined
  }
}

const VALID_EXTERNAL_ID_SCHEMES = new Set<ExternalIdScheme>(EXTERNAL_ID_SCHEMES)

/**
 * The scheme allowlist comes from the exported list rather than a second
 * hand-written one, so a scheme added to the union is never silently discarded
 * on load.
 */
function isDecodableExternalId(candidate: unknown): candidate is ExternalId {
  if (typeof candidate !== "object" || candidate === null) return false
  const { scheme, value } = candidate as { scheme?: unknown; value?: unknown }
  return (
    typeof scheme === "string" &&
    VALID_EXTERNAL_ID_SCHEMES.has(scheme as ExternalIdScheme) &&
    typeof value === "string" &&
    value.trim().length > 0
  )
}

/**
 * Decodes the JSON-encoded external_ids column (ADR 0010 / Slice 1), mirroring
 * decodeAliases. A bad member is dropped rather than failing the whole array —
 * one corrupt entry must not delete the good ones stored beside it — and
 * nothing surviving yields undefined, never an empty array: decodeRow assigns
 * every prop unconditionally, so presence is tested with != null and an empty
 * array here would report every row in a project as carrying ids.
 *
 * Whether a value is well-formed for its scheme (an IMO check digit, an LEI
 * length) is deliberately not checked here. That is a validation concern, and
 * dropping a malformed id at load would silently delete what the analyst typed
 * the next time the project is saved.
 */
export function decodeExternalIds(raw: unknown): ExternalId[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const ids = parsed.filter(isDecodableExternalId)
    return ids.length ? ids : undefined
  } catch {
    return undefined
  }
}

const VALID_LAYER_KINDS = new Set<NonNullable<Layer["kind"]>>(["echelon", "custom", "osm", "organisation"])

export function decodeLayerKind(raw: unknown): Layer["kind"] {
  return typeof raw === "string" && VALID_LAYER_KINDS.has(raw as NonNullable<Layer["kind"]>)
    ? (raw as NonNullable<Layer["kind"]>)
    : undefined
}

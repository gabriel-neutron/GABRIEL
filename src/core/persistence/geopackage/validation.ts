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

const VALID_LAYER_KINDS = new Set<NonNullable<Layer["kind"]>>(["echelon", "custom", "osm", "organisation"])

export function decodeLayerKind(raw: unknown): Layer["kind"] {
  return typeof raw === "string" && VALID_LAYER_KINDS.has(raw as NonNullable<Layer["kind"]>)
    ? (raw as NonNullable<Layer["kind"]>)
    : undefined
}

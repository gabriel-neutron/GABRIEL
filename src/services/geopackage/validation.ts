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

const VALID_LAYER_KINDS = new Set<NonNullable<Layer["kind"]>>(["echelon", "custom", "osm", "organisation"])

export function decodeLayerKind(raw: unknown): Layer["kind"] {
  return typeof raw === "string" && VALID_LAYER_KINDS.has(raw as NonNullable<Layer["kind"]>)
    ? (raw as NonNullable<Layer["kind"]>)
    : undefined
}

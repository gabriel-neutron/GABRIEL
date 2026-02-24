/**
 * Domain types for NATO symbol generation (MIL-STD-2525).
 * Used by symbol.service and map layers; no React or GeoPackage imports.
 */

export type SymbolAffiliation = "Friend" | "Hostile" | "Neutral" | "Unknown" | "Assumed Friend" | "Suspect"

export type SymbolDomain = "Ground" | "Air" | "Sea" | "Subsurface" | "Space"

/** Echelon options: single source for both type and UI/GeoPackage. Type derived from this array. */
export const ECHELON_OPTIONS = [
  { value: "Army", label: "Army" },
  { value: "Army Group/front", label: "Army Group/front" },
  { value: "Battalion/squadron", label: "Battalion/squadron" },
  { value: "Brigade", label: "Brigade" },
  { value: "Command", label: "Command" },
  { value: "Company/battery/troop", label: "Company/battery/troop" },
  { value: "Corps/MEF", label: "Corps/MEF" },
  { value: "Division", label: "Division" },
  { value: "Platoon/detachment", label: "Platoon/detachment" },
  { value: "Region/Theater", label: "Region/Theater" },
  { value: "Regiment/group", label: "Regiment/group" },
  { value: "Section", label: "Section" },
  { value: "Squad", label: "Squad" },
  { value: "Team/Crew", label: "Team/Crew" },
] as const

/** Echelon / size level for amplifier (SIDC positions 9-10). */
export type SymbolEchelon = (typeof ECHELON_OPTIONS)[number]["value"]

/** Standard identity / affiliation (frame shape and color). For Select UIs. */
export const AFFILIATION_OPTIONS: { value: SymbolAffiliation; label: string }[] = [
  { value: "Assumed Friend", label: "Assumed Friend" },
  { value: "Friend", label: "Friend" },
  { value: "Hostile", label: "Hostile" },
  { value: "Neutral", label: "Neutral" },
  { value: "Suspect", label: "Suspect" },
  { value: "Unknown", label: "Unknown" },
]

/** Battle dimension (symbol set selection). For Select UIs. */
export const DOMAIN_OPTIONS: { value: SymbolDomain; label: string }[] = [
  { value: "Air", label: "Air" },
  { value: "Ground", label: "Ground" },
  { value: "Sea", label: "Sea" },
  { value: "Space", label: "Space" },
  { value: "Subsurface", label: "Subsurface" },
]

/** Semantic unit type used by the app (maps to entity/type/subtype in symbol.service). */
export type UnitType =
  | "infantry"
  | "armored"
  | "artillery"
  | "air defense"
  | "engineer"
  | "signal"
  | "reconnaissance"
  | "aviation"
  | "command"
  | "unknown"

export interface SymbolServiceInput {
  unit: {
    id: string
    name: string
    type: string
    parent_id: string | null
    nato_symbol_code?: string | null
  }
  affiliation?: SymbolAffiliation
  echelon?: SymbolEchelon
  domain?: SymbolDomain
}

export interface SymbolServiceOutput {
  sidc: string
  options: {
    uniqueDesignation?: string
    quantity?: string
    direction?: number
    size?: number
  }
}

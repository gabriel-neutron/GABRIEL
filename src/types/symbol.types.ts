/**
 * Domain types for NATO symbol generation (MIL-STD-2525).
 * Used by symbol.service and map layers; no React or GeoPackage imports.
 */

export type SymbolAffiliation = "Friend" | "Hostile" | "Neutral" | "Unknown" | "Assumed Friend" | "Suspect"

export type SymbolDomain = "Ground" | "Air" | "Sea" | "Subsurface" | "Space"

/** Echelon / size level for amplifier (SIDC positions 9-10). */
export type SymbolEchelon =
  | "Team/Crew"
  | "Squad"
  | "Section"
  | "Platoon/detachment"
  | "Company/battery/troop"
  | "Battalion/squadron"
  | "Regiment/group"
  | "Brigade"
  | "Division"
  | "Corps/MEF"
  | "Army"
  | "Army Group/front"
  | "Region/Theater"
  | "Command"

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

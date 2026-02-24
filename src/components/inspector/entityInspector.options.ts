import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"

export type UnitTypeOption = { value: string; label: string }

/** Grouped unit types for Select (MIL-STD-2525 Land Unit symbol set 10). Values match symbol.service UNIT_TYPE_TO_FUNCTION_ID. */
export const UNIT_TYPE_OPTIONS_GROUPED: { label: string; options: UnitTypeOption[] }[] = [
  {
    label: "Combat",
    options: [
      { value: "air assault", label: "Air assault" },
      { value: "air defense", label: "Air defense" },
      { value: "air traffic services", label: "Air traffic services" },
      { value: "amphibious", label: "Amphibious" },
      { value: "antitank", label: "Antitank / antiarmour" },
      { value: "armored", label: "Armored" },
      { value: "artillery", label: "Artillery" },
      { value: "aviation", label: "Aviation (rotary)" },
      { value: "aviation composite", label: "Aviation (composite)" },
      { value: "aviation fixed wing", label: "Aviation (fixed wing)" },
      { value: "combat", label: "Combat" },
      { value: "combined arms", label: "Combined arms" },
      { value: "infantry", label: "Infantry" },
      { value: "mechanized infantry", label: "Mechanized infantry" },
      { value: "motorized infantry", label: "Motorized infantry" },
      { value: "observer", label: "Observer / observation" },
      { value: "ranger", label: "Ranger" },
      { value: "reconnaissance", label: "Reconnaissance" },
      { value: "sea-air-land", label: "Sea-air-land" },
      { value: "sniper", label: "Sniper" },
      { value: "special forces", label: "Special forces" },
      { value: "special operations", label: "Special operations" },
      { value: "surveillance", label: "Surveillance" },
      { value: "unmanned systems", label: "Unmanned systems" },
    ],
  },
  {
    label: "Combat support",
    options: [
      { value: "cbrn", label: "CBRN" },
      { value: "combat support", label: "Combat support" },
      { value: "engineer", label: "Engineer" },
      { value: "explosive ordnance disposal", label: "Explosive ordnance disposal" },
      { value: "military police", label: "Military police" },
      { value: "mine clearing", label: "Mine clearing" },
      { value: "search and rescue", label: "Search and rescue" },
      { value: "security", label: "Security" },
    ],
  },
  {
    label: "Command & control",
    options: [
      { value: "civil affairs", label: "Civil affairs" },
      { value: "civil-military cooperation", label: "Civil-military cooperation" },
      { value: "command", label: "Command & control" },
      { value: "information operations", label: "Information operations" },
      { value: "liaison", label: "Liaison" },
      { value: "military information support", label: "Military information support" },
      { value: "signal", label: "Signal" },
      { value: "special troops", label: "Special troops" },
    ],
  },
  {
    label: "Fires",
    options: [
      { value: "field artillery observer", label: "Field artillery observer" },
      { value: "joint fire support", label: "Joint fire support" },
      { value: "meteorological", label: "Meteorological" },
      { value: "missile", label: "Missile" },
      { value: "mortar", label: "Mortar" },
      { value: "survey", label: "Survey" },
    ],
  },
  {
    label: "Intelligence",
    options: [
      { value: "electronic warfare", label: "Electronic warfare" },
      { value: "military intelligence", label: "Military intelligence" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: "naval", label: "Naval (land)" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  {
    label: "Sustainment",
    options: [
      { value: "maintenance", label: "Maintenance" },
      { value: "medical", label: "Medical" },
      { value: "supply", label: "Supply" },
      { value: "sustainment", label: "Sustainment" },
      { value: "transportation", label: "Transportation" },
    ],
  },
]

/** Flat list of all unit type options (e.g. for lookups). */
export const UNIT_TYPE_OPTIONS: UnitTypeOption[] = UNIT_TYPE_OPTIONS_GROUPED.flatMap((g) => g.options)

/** Echelon / size (amplifier positions 9–10). */
export const ECHELON_OPTIONS: { value: SymbolEchelon; label: string }[] = [
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
]

/** Standard identity / affiliation (frame shape and color). */
export const AFFILIATION_OPTIONS: { value: SymbolAffiliation; label: string }[] = [
  { value: "Assumed Friend", label: "Assumed Friend" },
  { value: "Friend", label: "Friend" },
  { value: "Hostile", label: "Hostile" },
  { value: "Neutral", label: "Neutral" },
  { value: "Suspect", label: "Suspect" },
  { value: "Unknown", label: "Unknown" },
]

/** Battle dimension (symbol set selection). */
export const DOMAIN_OPTIONS: { value: SymbolDomain; label: string }[] = [
  { value: "Air", label: "Air" },
  { value: "Ground", label: "Ground" },
  { value: "Sea", label: "Sea" },
  { value: "Space", label: "Space" },
  { value: "Subsurface", label: "Subsurface" },
]
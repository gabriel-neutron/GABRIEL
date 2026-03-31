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
      { value: "aviation fixed wing", label: "Aviation (fixed wing)" },
      { value: "combined arms", label: "Combined arms" },
      { value: "infantry", label: "Infantry" },
      { value: "mechanized infantry", label: "Mechanized infantry" },
      { value: "motorized infantry", label: "Motorized infantry" },
      { value: "reconnaissance", label: "Reconnaissance" },
      { value: "sniper", label: "Sniper" },
      { value: "special forces", label: "Special forces" },
      { value: "special operations", label: "Special operations" },
    ],
  },
  {
    label: "Combat support",
    options: [
      { value: "cbrn", label: "CBRN" },
      { value: "combat support", label: "Combat support" },
      { value: "engineer", label: "Engineer" },
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
      { value: "signal", label: "Signal" },
      { value: "special troops", label: "Special troops" },
    ],
  },
  {
    label: "Fires",
    options: [
      { value: "field artillery observer", label: "Field artillery observer" },
      { value: "missile", label: "Missile" },
      { value: "mortar", label: "Mortar" },
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

/** Flat list of all unit type options (for lookups / validation). */
export const UNIT_TYPE_OPTIONS: UnitTypeOption[] = UNIT_TYPE_OPTIONS_GROUPED.flatMap((g) => g.options)
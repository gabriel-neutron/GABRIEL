/**
 * NATO symbol generation (MIL-STD-2525) via milsymbol.
 * Pure logic: SIDC building, type→entity mapping, symbol rendering. No React, no GeoPackage.
 */

import ms from "milsymbol"
import type { MapEntity } from "@/types/domain.types"
import type {
  SymbolAffiliation,
  SymbolDomain,
  SymbolEchelon,
  SymbolServiceInput,
  SymbolServiceOutput,
} from "@/types/symbol.types"

const SIDC_LENGTH = 20
const VERSION_2525D = "10"

/** Standard identity (position 2). In milsymbol: 0 = Reality, 1 = Exercise, 2 = Simulation. Use 0 so Hostile is not treated as Joker (Hostile+Exercise → Friend shape). */
const STANDARD_IDENTITY_REALITY = "0"

/** Affiliation to SIDC digit (position 4): 3=Friend, 6=Hostile/Faker, 4=Neutral, 1=Unknown, 2=Assumed Friend, 5=Suspect/Joker. */
const AFFILIATION_TO_DIGIT: Record<SymbolAffiliation, string> = {
  Friend: "3",
  Hostile: "6",
  Neutral: "4",
  Unknown: "1",
  "Assumed Friend": "2",
  Suspect: "5",
}

/** Echelon to amplifier (positions 9-10) per milsymbol numeric SIDC. */
const ECHELON_TO_AMPLIFIER: Record<SymbolEchelon, string> = {
  "Team/Crew": "11",
  Squad: "12",
  Section: "13",
  "Platoon/detachment": "14",
  "Company/battery/troop": "15",
  "Battalion/squadron": "16",
  "Regiment/group": "17",
  Brigade: "18",
  Division: "21",
  "Corps/MEF": "22",
  Army: "23",
  "Army Group/front": "24",
  "Region/Theater": "25",
  Command: "26",
}

/** Land Unit (symbol set 10) function ID: 6 digits. Keys match entityInspector UNIT_TYPE_OPTIONS value. */
const UNIT_TYPE_TO_FUNCTION_ID: Record<string, string> = {
  // Command & control (11xxxx)
  command: "110000",
  "civil affairs": "110200",
  "civil-military cooperation": "110300",
  "information operations": "110400",
  liaison: "110500",
  "military information support": "110600",
  signal: "111000",
  "special troops": "111400",
  // Combat (12xxxx)
  "air assault": "120100",
  "air traffic services": "120200",
  amphibious: "120300",
  antitank: "120400",
  armored: "120500",
  armour: "120500",
  aviation: "120600",
  "aviation composite": "120700",
  "aviation fixed wing": "120800",
  combat: "120900",
  "combined arms": "121000",
  infantry: "121100",
  "mechanized infantry": "121102",
  "motorized infantry": "121104",
  observer: "121200",
  reconnaissance: "121300",
  recon: "121300",
  "sea-air-land": "121400",
  sniper: "121500",
  surveillance: "121600",
  "special forces": "121700",
  "special operations": "121800",
  "unmanned systems": "121900",
  ranger: "122000",
  // Fires (13xxxx)
  "air defense": "130100",
  artillery: "130300",
  "field artillery observer": "130400",
  "joint fire support": "130500",
  meteorological: "130600",
  missile: "130700",
  mortar: "130800",
  survey: "130900",
  // Combat support (14xxxx)
  cbrn: "140100",
  "combat support": "140200",
  engineer: "140700",
  "explosive ordnance disposal": "140800",
  "military police": "141200",
  "mine clearing": "141400",
  security: "141700",
  "search and rescue": "141800",
  // Intelligence (15xxxx)
  "electronic warfare": "150500",
  "military intelligence": "151000",
  // Sustainment (16xxxx)
  sustainment: "160000",
  supply: "163400",
  transportation: "163600",
  medical: "161300",
  maintenance: "161100",
  // Other
  naval: "170100",
  unknown: "120900",
}

const DEFAULT_ECHELON_AMPLIFIER = "21" // Division
const DEFAULT_AFFILIATION: SymbolAffiliation = "Friend"
const DEFAULT_DOMAIN: SymbolDomain = "Ground"
const DOMAIN_TO_SYMBOL_SET: Record<SymbolDomain, string> = {
  Air: "01",
  Ground: "10",
  Sea: "30",
  Space: "05",
  Subsurface: "35",
}
const UNKNOWN_FUNCTION_ID = "000000"

let standardSet = false

function ensureStandard() {
  if (!standardSet) {
    ms.setStandard("2525")
    standardSet = true
  }
}

/**
 * Normalize unit type string to a key used in UNIT_TYPE_TO_FUNCTION_ID.
 */
function normalizeUnitType(type: string): string {
  const t = type.trim().toLowerCase()
  return t || "unknown"
}

/**
 * Returns 20-digit SIDC for Land Unit (symbol set 10) from semantic inputs.
 */
function buildDerivedSidc(
  affiliation: SymbolAffiliation,
  symbolSet: string,
  echelonAmplifier: string,
  functionId: string,
): string {
  const pos3 = AFFILIATION_TO_DIGIT[affiliation] ?? "1"
  const version = VERSION_2525D
  const standardId = STANDARD_IDENTITY_REALITY
  const status = "0"
  const hq = "0"
  const mod1 = "00"
  const mod2 = "00"
  return (
    version +
    standardId +
    pos3 +
    symbolSet +
    status +
    hq +
    echelonAmplifier +
    functionId +
    mod1 +
    mod2
  )
}

/**
 * Maps a MapEntity to SymbolServiceInput (unit uses parent_id for DB compatibility).
 */
export function mapEntityToSymbolInput(entity: MapEntity): SymbolServiceInput {
  return {
    unit: {
      id: entity.id,
      name: entity.name,
      type: entity.type ?? "unknown",
      parent_id: entity.parentId,
      nato_symbol_code: entity.natoSymbolCode ?? undefined,
    },
    affiliation: entity.affiliation ?? DEFAULT_AFFILIATION,
    echelon: entity.echelon as SymbolEchelon | undefined,
    domain: (entity.domain as SymbolDomain) ?? DEFAULT_DOMAIN,
  }
}

/**
 * Validates stored SIDC: 20 digits, optional check for land unit set.
 */
export function isValidSidc(sidc: string): boolean {
  if (typeof sidc !== "string" || sidc.length !== SIDC_LENGTH) return false
  return /^\d+$/.test(sidc)
}

/**
 * Extracts a leading designation token in the form:
 * - 1 to 4 digits
 * - followed by 1 to 2 letters
 * Examples: "1st", "2nd", "12A", "333rd".
 * Returns "" when no matching leading token exists.
 */
function extractNumericDesignation(name: string): string {
  const firstToken = name.trim().split(/\s+/)[0] ?? ""
  const cleanedToken = firstToken.replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z]+$/g, "")
  return /^(\d{1,4}[A-Za-z]{1,2})$/.exec(cleanedToken)?.[1] ?? ""
}

function extractInitials(name: string, maxLetters = 3): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ""
  const initials = words.map((w) => w[0]?.toUpperCase() ?? "").join("")
  return initials.slice(0, maxLetters)
}

/**
 * Returns SIDC and options for a unit. Prefers stored nato_symbol_code when valid;
 * otherwise derives from type, echelon, domain (Land only for now).
 */
export function getSymbolForUnit(input: SymbolServiceInput): SymbolServiceOutput {
  const affiliation = input.affiliation ?? DEFAULT_AFFILIATION
  const domain = input.domain ?? DEFAULT_DOMAIN
  const unit = input.unit

  let sidc: string

  if (unit.nato_symbol_code && isValidSidc(unit.nato_symbol_code)) {
    sidc = unit.nato_symbol_code
  } else {
    const typeKey = normalizeUnitType(unit.type)
    const symbolSet = DOMAIN_TO_SYMBOL_SET[domain] ?? DOMAIN_TO_SYMBOL_SET.Ground
    const echelon = input.echelon
    const echelonAmplifier = echelon ? ECHELON_TO_AMPLIFIER[echelon] : DEFAULT_ECHELON_AMPLIFIER
    const functionId =
      domain === "Ground"
        ? (UNIT_TYPE_TO_FUNCTION_ID[typeKey] ?? UNIT_TYPE_TO_FUNCTION_ID.unknown)
        : UNKNOWN_FUNCTION_ID
    sidc = buildDerivedSidc(affiliation, symbolSet, echelonAmplifier, functionId)
  }

  return {
    sidc,
    options: {
      uniqueDesignation: extractNumericDesignation(unit.name) || extractInitials(unit.name, 3),
      size: 40,
    },
  }
}

export interface RenderedSymbol {
  svg: string
  anchor: { x: number; y: number }
  width: number
  height: number
}

const renderCache = new Map<string, RenderedSymbol>()

function cacheKey(sidc: string, options: SymbolServiceOutput["options"] = {}): string {
  return `${sidc}|${options.uniqueDesignation ?? ""}|${options.size ?? 40}|outline`
}

/**
 * Renders symbol to SVG and returns SVG string plus anchor for map placement.
 * Caches by SIDC + uniqueDesignation to avoid repeated milsymbol calls.
 */
export function renderSymbol(sidc: string, options: SymbolServiceOutput["options"] = {}): RenderedSymbol {
  ensureStandard()
  const key = cacheKey(sidc, options)
  const cached = renderCache.get(key)
  if (cached) return cached

  const symbol = new ms.Symbol(sidc, {
    uniqueDesignation: options.uniqueDesignation,
    quantity: options.quantity,
    direction: options.direction,
    size: options.size ?? 40,
    outlineWidth: 2,
    outlineColor: "white",
  })

  const svg = symbol.asSVG()
  const anchor = symbol.getAnchor()
  const size = symbol.getSize()

  const result: RenderedSymbol = {
    svg,
    anchor: { x: anchor.x, y: anchor.y },
    width: size.width,
    height: size.height,
  }
  renderCache.set(key, result)
  return result
}

export function getRenderedSymbolForEntity(entity: MapEntity, size = 40): RenderedSymbol {
  const input = mapEntityToSymbolInput(entity)
  const { sidc, options } = getSymbolForUnit(input)
  return renderSymbol(sidc, { ...options, size })
}

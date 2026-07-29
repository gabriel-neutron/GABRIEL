/**
 * External identifiers an entity is known by in registries and sanctions lists
 * (Slice 1). The comparable form is derived on demand and never stored, so
 * re-normalising later cannot rewrite what the analyst entered.
 */
export type ExternalIdScheme =
  | "imo" | "inn" | "ogrn" | "lei"
  | "ofac" | "eu_fsf" | "uk_hmt" | "opensanctions" | "registry"

export type ExternalId = {
  scheme: ExternalIdScheme
  /** The raw string the analyst typed, preserved as entered. */
  value: string
}

/**
 * Display strings for the scheme picker. Typed as a full Record so the compiler
 * fails the day a tenth scheme joins the union without a label.
 */
export const EXTERNAL_ID_LABELS: Record<ExternalIdScheme, string> = {
  imo: "IMO number",
  inn: "INN",
  ogrn: "OGRN",
  lei: "LEI",
  ofac: "OFAC SDN id",
  eu_fsf: "EU FSF id",
  uk_hmt: "UK HMT id",
  opensanctions: "OpenSanctions id",
  registry: "Registry id",
}

/**
 * The runtime scheme list, for decoders that must reject a scheme read off disk.
 * Derived from EXTERNAL_ID_LABELS rather than hand-written a second time, since
 * that record's type already forces it to hold exactly the union's members —
 * a second array could drift from the union and from it.
 */
export const EXTERNAL_ID_SCHEMES: readonly ExternalIdScheme[] = Object.keys(
  EXTERNAL_ID_LABELS,
) as ExternalIdScheme[]

const KNOWN_SCHEMES = new Set<string>(EXTERNAL_ID_SCHEMES)

/**
 * Membership here is what makes a scheme "structured": only these strip
 * separators and a leading scheme prefix, and only these have a length the
 * prefix strip can be checked against.
 */
const EXPECTED_LENGTHS: Partial<Record<ExternalIdScheme, readonly number[]>> = {
  imo: [7],
  inn: [10, 12],
  ogrn: [13, 15],
  lei: [20],
}

const SCHEME_PREFIXES: Partial<Record<ExternalIdScheme, string>> = {
  imo: "IMO",
  inn: "INN",
  ogrn: "OGRN",
  lei: "LEI",
}

/**
 * Whitespace, hyphen and full stop — the separators these identifiers are
 * actually written with ("IMO 9074729", "1027-7001-32195"). Nothing else is
 * removed: a character outside a scheme's charset must survive normalisation so
 * that `isValidExternalId` can reject it rather than silently swallow it.
 */
const STRUCTURED_SEPARATORS = /[\s.-]+/g

const WHITESPACE_RUN = /\s+/g

const IMO_WEIGHTS = [7, 6, 5, 4, 3, 2]

const IMO_PATTERN = /^\d{7}$/
const INN_PATTERN = /^\d{10}$|^\d{12}$/
const OGRN_PATTERN = /^\d{13}$|^\d{15}$/
const LEI_PATTERN = /^[0-9A-Z]{20}$/

/**
 * Digits one to six weighted 7, 6, 5, 4, 3, 2; the sum mod 10 is digit seven.
 * Caller has already established seven ASCII digits.
 */
function hasValidImoCheckDigit(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < IMO_WEIGHTS.length; i += 1) {
    sum += Number(digits[i]) * IMO_WEIGHTS[i]
  }
  return sum % 10 === Number(digits[6])
}

/**
 * Scheme-specific normalisation, so "IMO 9074729" and "9074729" compare equal.
 *
 * A structured scheme's leading prefix is dropped only if what remains still has
 * a length that scheme expects. The guard matters for LEI: a legitimate
 * 20-character LEI may itself begin with the letters LEI, and stripping them
 * would turn a valid id invalid. It also keeps the function idempotent.
 *
 * A free-form value has its whitespace collapsed and nothing else touched —
 * including its case. A hyphen or a dot carries meaning inside an opaque
 * registry string ("EU.1234.56"), so stripping those could merge two distinct
 * ids onto one dedup key, and such an id may legitimately start with its own
 * registry's name. Case is the same argument: an OpenSanctions entity id is a
 * case-sensitive token, so upper-casing "NK-a7bC" and "nk-a7bc" onto one key
 * would silently merge two register rows into one entity (owner ruling on Q31,
 * 2026-07-29 — this branch previously upper-cased too, which contradicted the
 * separator rule directly above it).
 *
 * A value that is not a string at runtime (persisted JSON is not type-checked)
 * normalises to the empty string, which every validity rule rejects.
 */
export function normalizeExternalId(scheme: ExternalIdScheme, value: string): string {
  if (typeof value !== "string") return ""

  const lengths = EXPECTED_LENGTHS[scheme]
  if (lengths === undefined) return value.trim().replace(WHITESPACE_RUN, " ")

  const compact = value.toUpperCase().replace(STRUCTURED_SEPARATORS, "")
  const prefix = SCHEME_PREFIXES[scheme]
  if (prefix !== undefined && compact.startsWith(prefix)) {
    const stripped = compact.slice(prefix.length)
    if (lengths.includes(stripped.length)) return stripped
  }
  return compact
}

/**
 * Stable map key for exact deduplication. Built by concatenation rather than a
 * template literal (Trap T7). Nothing is persisted — the normalised form is
 * recomputed here at every comparison.
 */
export function externalIdKey(id: ExternalId): string {
  return id.scheme + ":" + normalizeExternalId(id.scheme, id.value)
}

/**
 * Structural validity only: length, charset, and the IMO check digit. It says
 * nothing about whether the identifier exists in the real register.
 *
 * It checks the **normalised** form, not the raw one — the raw value is
 * preserved as entered, so a raw check would reject "IMO 9074729" while
 * `externalIdKey` treats it as identical to the valid "9074729".
 *
 * LEI carries **no mod-97 check** in this slice. That is a deliberate, recorded
 * gap, not an oversight: a typo'd LEI of the right shape passes here, and the
 * test pinning that has to be changed on purpose when a later slice closes it.
 */
export function isValidExternalId(id: ExternalId): boolean {
  if (!KNOWN_SCHEMES.has(id.scheme)) return false

  const normalized = normalizeExternalId(id.scheme, id.value)
  if (normalized.length === 0) return false

  switch (id.scheme) {
    case "imo":
      return IMO_PATTERN.test(normalized) && hasValidImoCheckDigit(normalized)
    case "inn":
      return INN_PATTERN.test(normalized)
    case "ogrn":
      return OGRN_PATTERN.test(normalized)
    case "lei":
      return LEI_PATTERN.test(normalized)
    default:
      return true
  }
}

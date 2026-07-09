const SOURCES_DELIMITER = "\n"

/** Parses the Provenance Ledger's newline-delimited URL string (the legacy raw column, passed as `EntityLedgerInput.sources`). */
export function parse(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(SOURCES_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function serialize(urls: string[]): string | null {
  const cleaned = urls.map((u) => u.trim()).filter((u) => u.length > 0)
  return cleaned.length > 0 ? cleaned.join(SOURCES_DELIMITER) : null
}

/** True when the Provenance Ledger is empty — the ADR-0001 gate for independent proposals. */
export function shouldPropose(raw?: string | null): boolean {
  return parse(raw).length === 0
}

/** Merges new URLs into the existing ledger, deduplicating and preserving existing-first order. */
export function merge(existingRaw: string | null | undefined, newUrls: string[]): string | null {
  const merged = [...new Set([...parse(existingRaw), ...newUrls.map((u) => u.trim()).filter(Boolean)])]
  return serialize(merged)
}

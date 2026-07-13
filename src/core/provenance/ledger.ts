const SOURCES_DELIMITER = "\n"

/** Parses the Provenance Ledger's newline-delimited URL string (the legacy raw column, passed as `EntityLedgerInput.sources`). */
export function parse(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(SOURCES_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

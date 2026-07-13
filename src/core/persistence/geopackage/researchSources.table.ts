import type { GeoPackage } from "@ngageoint/geopackage"

export const RESEARCH_SOURCES_TABLE = "research_sources"

/**
 * Keyed by URL -> cached snippet, not a typed domain row, so this table stays
 * hand-written rather than descriptor-driven. `fetched_at` is written but never
 * read back by `readSourceCache` — a pre-existing dead column, left as-is.
 */
export function createResearchSourcesTable(geoPackage: GeoPackage): void {
  geoPackage.connection.run(`CREATE TABLE IF NOT EXISTS ${RESEARCH_SOURCES_TABLE} (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  content TEXT,
  fetched_at TEXT
)`)
}

export function readSourceCache(geoPackage: GeoPackage): Map<string, string> {
  try {
    const rows = geoPackage.connection.all(
      `SELECT url, content FROM ${RESEARCH_SOURCES_TABLE}`,
    ) as Array<{ url: string; content: string | null }>
    const cache = new Map<string, string>()
    for (const row of rows) {
      if (row.url && row.content) {
        cache.set(row.url, row.content)
      }
    }
    return cache
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(`Unsupported schema: failed to read research_sources table (${message}).`)
  }
}

export function writeSourceCache(geoPackage: GeoPackage, researchSources?: Map<string, string>): void {
  if (!researchSources) return
  for (const [url, content] of researchSources.entries()) {
    geoPackage.connection.run(
      `INSERT INTO ${RESEARCH_SOURCES_TABLE} (id, url, content, fetched_at) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), url, content, new Date().toISOString()],
    )
  }
}

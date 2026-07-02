import type { GeoPackageConnection } from "@ngageoint/geopackage"

/**
 * One column-descriptor list per SQL table drives CREATE TABLE, SELECT,
 * row-decoding, and INSERT from a single source, so adding a field is one
 * edit instead of separate edits to each SQL surface.
 */
export type SqlValue = string | number | null

export interface DecodeContext<T> {
  /** Raw SQL row for this table (unprocessed column values). */
  row: Record<string, unknown>
  /** Props already decoded earlier in the same descriptor array — lets a later
   *  column's decode depend on an earlier column's typed, validated value. */
  decoded: Partial<T>
}

export interface ColumnDescriptor<T, K extends keyof T = keyof T> {
  prop: K
  column: string
  sqlType: "TEXT" | "INTEGER"
  /** Raw SQL fragment appended after `column sqlType`, e.g. "PRIMARY KEY", "NOT NULL". */
  constraints?: string
  encode: (value: T[K], row: T) => SqlValue
  decode: (raw: unknown, ctx: DecodeContext<T>) => T[K]
  /** True if this column may be absent on an older, pre-migration schema. */
  optional?: boolean
  /** SQL expression substituted (aliased to `column`) when `optional` and the column is missing. */
  fallbackSql?: string
}

export function buildCreateTableColumnDefs<T>(descriptors: ColumnDescriptor<T>[]): string[] {
  return descriptors.map((d) => `${d.column} ${d.sqlType}${d.constraints ? ` ${d.constraints}` : ""}`)
}

export function getTableColumnNames(connection: GeoPackageConnection, tableName: string): Set<string> {
  try {
    const rows = connection.all(`PRAGMA table_info(${tableName})`) as Array<{ name?: string }>
    return new Set(
      rows.map((row) => (row.name != null ? String(row.name) : "")).filter((name) => name.length > 0),
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(`Unsupported schema: failed to inspect '${tableName}' columns (${message}).`)
  }
}

export function buildSelectClause<T>(descriptors: ColumnDescriptor<T>[], availableColumns?: Set<string>): string {
  return descriptors
    .map((d) => {
      if (!d.optional) return d.column
      if (!availableColumns) {
        throw new Error(`columnDescriptor: '${d.column}' is optional but no availableColumns set was provided.`)
      }
      if (d.fallbackSql == null) {
        throw new Error(`columnDescriptor: '${d.column}' is optional but has no fallbackSql.`)
      }
      return availableColumns.has(d.column) ? d.column : `${d.fallbackSql} AS ${d.column}`
    })
    .join(", ")
}

export function decodeRow<T>(descriptors: ColumnDescriptor<T>[], row: Record<string, unknown>): T {
  const decoded: Partial<T> = {}
  for (const d of descriptors) {
    decoded[d.prop] = d.decode(row[d.column], { row, decoded })
  }
  return decoded as T
}

export function buildInsertColumns<T>(descriptors: ColumnDescriptor<T>[]): string[] {
  return descriptors.map((d) => d.column)
}

export function buildInsertValues<T>(descriptors: ColumnDescriptor<T>[], value: T): SqlValue[] {
  return descriptors.map((d) => d.encode(value[d.prop], value))
}

export function insertRow<T>(
  connection: GeoPackageConnection,
  table: string,
  descriptors: ColumnDescriptor<T>[],
  value: T,
): void {
  const columns = buildInsertColumns(descriptors)
  const placeholders = columns.map(() => "?").join(", ")
  connection.run(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    buildInsertValues(descriptors, value),
  )
}

/** Whole-table-missing check (older projects predating a table's introduction) —
 *  a different failure mode than a single missing column, so kept separate from
 *  the `optional`/`fallbackSql` per-column mechanism. */
export function tableExists(connection: GeoPackageConnection, tableName: string): boolean {
  return connection.isTableExists(tableName)
}

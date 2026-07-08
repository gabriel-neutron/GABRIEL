import { describe, expect, it, vi } from "vitest"
import type { GeoPackageConnection } from "@ngageoint/geopackage"
import {
  buildCreateTableColumnDefs,
  buildInsertColumns,
  buildInsertValues,
  buildSelectClause,
  decodeRow,
  ensureOptionalColumns,
  getTableColumnNames,
  insertRow,
  tableExists,
  type ColumnDescriptor,
} from "./columnDescriptor"

interface Widget {
  id: string
  count: number
  label?: string
}

function widgetColumns(): ColumnDescriptor<Widget>[] {
  return [
    { prop: "id", column: "id", sqlType: "TEXT", constraints: "PRIMARY KEY", encode: (v) => String(v), decode: (raw) => String(raw) },
    { prop: "count", column: "count", sqlType: "INTEGER", encode: (v) => Number(v), decode: (raw) => Number(raw) },
    {
      prop: "label",
      column: "label",
      sqlType: "TEXT",
      optional: true,
      fallbackSql: "NULL",
      encode: (v) => (v != null ? String(v) : null),
      decode: (raw) => (raw != null ? String(raw) : undefined),
    },
  ]
}

describe("buildCreateTableColumnDefs", () => {
  it("includes constraints when present and omits them when absent", () => {
    expect(buildCreateTableColumnDefs(widgetColumns())).toEqual([
      "id TEXT PRIMARY KEY",
      "count INTEGER",
      "label TEXT",
    ])
  })
})

describe("buildSelectClause", () => {
  it("selects a bare column name when not optional", () => {
    expect(buildSelectClause([widgetColumns()[0]])).toBe("id")
  })

  it("selects the bare column when optional and available", () => {
    const clause = buildSelectClause(widgetColumns(), new Set(["id", "count", "label"]))
    expect(clause).toBe("id, count, label")
  })

  it("substitutes fallbackSql aliased to the column name when optional and missing", () => {
    const clause = buildSelectClause(widgetColumns(), new Set(["id", "count"]))
    expect(clause).toBe("id, count, NULL AS label")
  })

  it("throws when optional without an availableColumns set", () => {
    expect(() => buildSelectClause(widgetColumns())).toThrow(/no availableColumns set/)
  })

  it("throws when optional without a fallbackSql", () => {
    const badColumns: ColumnDescriptor<Widget>[] = [
      { prop: "label", column: "label", sqlType: "TEXT", optional: true, encode: (v) => (v ?? null), decode: (raw) => (raw != null ? String(raw) : undefined) },
    ]
    expect(() => buildSelectClause(badColumns, new Set())).toThrow(/no fallbackSql/)
  })
})

describe("decodeRow", () => {
  it("decodes each column by name into the prop it maps to", () => {
    const row = decodeRow(widgetColumns(), { id: "w-1", count: "3", label: "Widget" })
    expect(row).toEqual({ id: "w-1", count: 3, label: "Widget" })
  })

  it("lets a later column's decode read an earlier column's already-decoded value", () => {
    interface Pair {
      flag: boolean
      derived: string
    }
    const columns: ColumnDescriptor<Pair>[] = [
      { prop: "flag", column: "flag", sqlType: "INTEGER", encode: (v) => (v ? 1 : 0), decode: (raw) => Number(raw) === 1 },
      {
        prop: "derived",
        column: "derived",
        sqlType: "TEXT",
        encode: (v) => String(v),
        decode: (raw, ctx) => (ctx.decoded.flag ? String(raw) : "suppressed"),
      },
    ]
    expect(decodeRow(columns, { flag: 1, derived: "value" })).toEqual({ flag: true, derived: "value" })
    expect(decodeRow(columns, { flag: 0, derived: "value" })).toEqual({ flag: false, derived: "suppressed" })
  })
})

describe("buildInsertColumns / buildInsertValues", () => {
  it("builds parallel column names and encoded values", () => {
    const widget: Widget = { id: "w-1", count: 3, label: "Widget" }
    expect(buildInsertColumns(widgetColumns())).toEqual(["id", "count", "label"])
    expect(buildInsertValues(widgetColumns(), widget)).toEqual(["w-1", 3, "Widget"])
  })
})

describe("insertRow", () => {
  it("runs a parameterized INSERT built from the descriptor columns/values", () => {
    const run = vi.fn()
    const connection = { run } as unknown as GeoPackageConnection
    const widget: Widget = { id: "w-1", count: 3, label: undefined }
    insertRow(connection, "widgets", widgetColumns(), widget)
    expect(run).toHaveBeenCalledWith(
      "INSERT INTO widgets (id, count, label) VALUES (?, ?, ?)",
      ["w-1", 3, null],
    )
  })
})

describe("getTableColumnNames", () => {
  it("returns the set of column names from PRAGMA table_info", () => {
    const all = vi.fn(() => [{ name: "id" }, { name: "count" }, { name: "label" }])
    const connection = { all } as unknown as GeoPackageConnection
    expect(getTableColumnNames(connection, "widgets")).toEqual(new Set(["id", "count", "label"]))
    expect(all).toHaveBeenCalledWith("PRAGMA table_info(widgets)")
  })

  it("wraps a query failure as an 'Unsupported schema' error", () => {
    const all = vi.fn(() => {
      throw new Error("no such table")
    })
    const connection = { all } as unknown as GeoPackageConnection
    expect(() => getTableColumnNames(connection, "widgets")).toThrow(/Unsupported schema.*widgets/)
  })
})

describe("ensureOptionalColumns", () => {
  it("ALTERs in only the optional columns physically missing from the table", () => {
    const all = vi.fn(() => [{ name: "id" }, { name: "count" }])
    const run = vi.fn()
    const connection = { all, run } as unknown as GeoPackageConnection
    ensureOptionalColumns(connection, "widgets", widgetColumns())
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith("ALTER TABLE widgets ADD COLUMN label TEXT")
  })

  it("is a no-op when every optional column is already present", () => {
    const all = vi.fn(() => [{ name: "id" }, { name: "count" }, { name: "label" }])
    const run = vi.fn()
    const connection = { all, run } as unknown as GeoPackageConnection
    ensureOptionalColumns(connection, "widgets", widgetColumns())
    expect(run).not.toHaveBeenCalled()
  })
})

describe("tableExists", () => {
  it("delegates to the connection's isTableExists", () => {
    const isTableExists = vi.fn(() => true)
    const connection = { isTableExists } as unknown as GeoPackageConnection
    expect(tableExists(connection, "organisations")).toBe(true)
    expect(isTableExists).toHaveBeenCalledWith("organisations")
  })
})

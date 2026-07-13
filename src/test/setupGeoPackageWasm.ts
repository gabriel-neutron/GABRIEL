import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { SqljsAdapter } from "@ngageoint/geopackage"

// Under Node, rtree-sql.js's default WASM loader tries `fetch()` on a bare
// filename or mis-resolves a `file://` URL through `path.normalize` (see
// node_modules/rtree-sql.js/dist/sql-wasm.js), so `locateFile` alone can't
// fix this cross-platform. Instead, pre-warm SqljsAdapter's cached SQL module
// with the wasm bytes read straight off disk, bypassing that loader entirely.
const require = createRequire(import.meta.url)
const initSqlJs = require("rtree-sql.js")
const wasmBinary = readFileSync(require.resolve("rtree-sql.js/dist/sql-wasm.wasm"))

SqljsAdapter.SQL = await initSqlJs({ wasmBinary })

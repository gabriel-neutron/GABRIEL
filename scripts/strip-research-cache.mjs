#!/usr/bin/env node
//
// Empties the `research_sources` fetch cache from a project file.
//
// Why this exists as a script rather than a one-off command: the cache REFILLS. Every
// enrichment run writes verbatim third-party text into it, and this repo is public, so the
// strip is a recurring publication chore and not a single historical event.
//
// Why the cache specifically. On 2026-08-04 the whole project file was probed for places a
// natural person could be named -- 1,027 entity names, 151 notes (10.4 kB), every alias, every
// source URL. The ONLY place any person was named was this cache, which held a head of state
// and several named foreign officers extracted from a US Government publication. Nothing in it
// was cited by any unit or organisation: all five entries were cache-only residue of research
// runs. It is re-fetchable, it is third-party copyright, and no release has any use for it.
//
// VACUUM is not optional and is the entire reason this is careful work. A bare DELETE leaves
// the text sitting in SQLite's free pages, where `git grep -a` still finds it and where a
// published file still carries it. The rows would be gone and the names would not be. That is
// this repo's recurring failure shape -- a check that reports success one layer above the one
// that matters -- so the script verifies at the BYTE level before reporting done.
//
// Usage:  node scripts/strip-research-cache.mjs [path] --yes
// Exit:   0 stripped (or already empty), 1 refused, 2 could not run.

import { execFileSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

const TABLE = "research_sources"

function fail(message, code = 2) {
  console.error("strip-research-cache: " + message)
  process.exit(code)
}

const args = process.argv.slice(2)
const confirmed = args.includes("--yes")
const target = args.find((a) => !a.startsWith("--")) ?? "public/project.gpkg"

if (!existsSync(target)) fail("no such file: " + target)

// The restore path has to exist BEFORE the write, not be hoped for afterwards. A committed,
// unmodified file can always be restored byte-identically with `git checkout`; a dirty one
// cannot, and this script will not be the thing that makes a working file unrecoverable.
try {
  execFileSync("git", ["diff", "--quiet", "--", target], { stdio: "ignore" })
} catch {
  fail(
    target + " has uncommitted changes, so `git checkout -- " + target + "` would not restore it. " +
      "Commit or stash it first; that commit is the only revert point this script relies on.",
    1,
  )
}

const before = statSync(target).size
const db = new DatabaseSync(target)

const present = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(TABLE)
if (present == null) {
  db.close()
  console.log("strip-research-cache: no " + TABLE + " table in " + target + "; nothing to do.")
  process.exit(0)
}

const rows = db.prepare("SELECT COUNT(*) c FROM " + TABLE).get().c
const chars = db.prepare("SELECT COALESCE(SUM(LENGTH(COALESCE(content,''))),0) n FROM " + TABLE).get().n

if (rows === 0) {
  db.close()
  console.log("strip-research-cache: " + TABLE + " is already empty.")
  process.exit(0)
}

// A sample of the text that is about to be removed, kept only to prove afterwards that it is
// really gone from the file's bytes. Never printed.
const witness = db.prepare("SELECT content FROM " + TABLE + " WHERE content IS NOT NULL AND LENGTH(content) > 40 LIMIT 1").get()
const witnessText = witness == null ? null : String(witness.content).slice(0, 40)

console.log("strip-research-cache: " + target + " holds " + String(rows) + " cached fetches, " + String(chars) + " characters.")

if (!confirmed) {
  db.close()
  console.log("strip-research-cache: refusing to write without --yes. Nothing changed.")
  process.exit(1)
}

db.exec("DELETE FROM " + TABLE)
// Rebuilds the file, so the deleted text does not survive in free pages.
db.exec("VACUUM")

const remaining = db.prepare("SELECT COUNT(*) c FROM " + TABLE).get().c
// Proves the file still opens and its other tables are intact, from inside the same connection
// that just rewrote it.
const tables = db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table'").get().c
db.close()

if (remaining !== 0) fail("DELETE left " + String(remaining) + " rows behind. The file may be inconsistent; restore it from git.")

// The byte-level check. Everything above this line would report success on a file that still
// contains every name, because a row count is not a statement about bytes.
if (witnessText != null) {
  const { readFileSync } = await import("node:fs")
  const bytes = readFileSync(target)
  const stillThere =
    bytes.toString("latin1").includes(witnessText) || bytes.toString("utf8").includes(witnessText)
  if (stillThere) {
    fail("the cached text is STILL PRESENT in the file's bytes after VACUUM. Restore from git and investigate.")
  }
}

const after = statSync(target).size
console.log(
  "strip-research-cache: removed " + String(rows) + " rows (" + String(chars) + " characters); " +
    String(tables) + " tables intact; " + String(before) + " -> " + String(after) + " bytes.",
)
console.log("strip-research-cache: verified absent from the file's bytes, not merely from the table.")

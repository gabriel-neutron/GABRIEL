#!/usr/bin/env node
//
// Trap T7 guard. This repo has a recorded history of spaces inside TS template literals
// becoming NUL bytes, which corrupts git diffs and is invisible in an editor.
//
// Why this is a committed script and not a command line copied between documents:
// the form printed in docs/SLICE_BUILD_LOOP.md and the Slice 0/1 build spec until
// 2026-07-29 was VACUOUS under Git Bash. The shell collapsed the NUL escape to an
// empty-string argument, so ripgrep matched the empty pattern on every line of every
// file and exited 0 whether or not a NUL byte was present. Measured against a control
// file: a two-line NUL-free file and a file containing a NUL both reported the same
// count and the same exit code. The check reported green vacuously for every slice
// that ran it. See Q36 in docs/timelines/SLICE_0_1_OPEN_QUESTIONS.md.
//
// Usage:  node scripts/scan-nul.mjs [root ...]     (default roots: src docs scripts)
// Exit:   0 clean, 1 NUL bytes found, 2 the scan could not run.
//
// Exit 2 is never a pass. A scan that cannot enumerate files, or whose own detector
// does not detect, reports failure rather than silence -- that distinction is the
// entire reason this file exists.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { extname } from "node:path"

const DEFAULT_ROOTS = ["src", "docs", "scripts"]

// Skipped so a future binary asset committed under a scanned root cannot turn this
// guard into permanent noise. Every path skipped for this reason is reported.
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
  ".gpkg", ".sqlite", ".db", ".woff", ".woff2", ".ttf", ".eot",
])

const containsNulByte = (buffer) => buffer.includes(0)

// A guard that cannot fail is the exact defect this script was written to replace,
// so the detector proves itself on every run before it is allowed to report clean.
const detectorIsSound =
  containsNulByte(Buffer.from([0x68, 0x00, 0x69])) &&
  !containsNulByte(Buffer.from("hi", "utf8"))

if (!detectorIsSound) {
  console.error("scan-nul: self-check failed, the detector does not detect. Refusing to report clean.")
  process.exit(2)
}

const roots = process.argv.slice(2)
const scanRoots = (roots.length > 0 ? roots : DEFAULT_ROOTS).filter((root) => existsSync(root))

if (scanRoots.length === 0) {
  console.error("scan-nul: none of the requested roots exist: " + (roots.length > 0 ? roots : DEFAULT_ROOTS).join(" "))
  process.exit(2)
}

// git ls-files enumerates tracked files AND untracked-but-not-ignored ones, which is
// exactly the set a slice run produces. It also inherits .gitignore, so node_modules,
// dist and coverage need no hand-maintained skip list. -z because paths may contain
// spaces, and because this is a NUL-byte scanner that would rather not parse newlines.
let listed
try {
  listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--"].concat(scanRoots),
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )
} catch (error) {
  console.error("scan-nul: could not enumerate files via git: " + String(error && error.message))
  process.exit(2)
}

const candidates = listed.split("\0").filter((path) => path.length > 0)
const skipped = []
const hits = []
let scannedCount = 0

for (const path of candidates) {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) {
    skipped.push(path)
    continue
  }
  // git lists tracked-but-deleted paths too; a missing file is not a finding.
  if (!existsSync(path) || !statSync(path).isFile()) continue

  scannedCount += 1
  if (containsNulByte(readFileSync(path))) hits.push(path)
}

// Zero files scanned means the enumeration silently produced nothing. That is the
// vacuous-green shape, not a clean tree.
if (scannedCount === 0) {
  console.error("scan-nul: enumerated 0 files under " + scanRoots.join(" ") + ". Refusing to report clean.")
  process.exit(2)
}

for (const path of skipped) {
  console.log("scan-nul: skipped (binary extension) " + path)
}

if (hits.length > 0) {
  for (const path of hits) {
    console.error("scan-nul: NUL byte in " + path)
  }
  console.error("scan-nul: FAIL, " + hits.length + " of " + scannedCount + " files contain a NUL byte.")
  process.exit(1)
}

console.log("scan-nul: clean, " + scannedCount + " files scanned under " + scanRoots.join(" ") + ".")

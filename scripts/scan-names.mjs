#!/usr/bin/env node
//
// The pre-push name scan. Gabriel is a sanctions-evasion OSINT project on a PUBLIC
// repo, so the two operators' real names must never appear in it -- not in file
// contents, not in filenames, not in a commit message, not in git author metadata.
// Attribution here is a personal-safety matter, not a style preference.
//
// Why this is a committed script and not a command line retyped each push:
//
//   1. `git grep` alone only searches the CURRENT tree. A name removed in a later
//      commit is still in history and still published by a push.
//   2. `strings` is NOT installed on this machine. Every `strings`-based binary scan
//      prints nothing and looks clean whatever the file contains. Recorded as a trap
//      on 2026-08-04.
//   3. The scan has to cover public/project.gpkg, a 5 MB SQLite blob. A text-only
//      scan silently skips the one file most likely to carry a real name.
//
// The names themselves are supplied OUT OF BAND and never committed:
//
//   GABRIEL_SCAN_NAMES="ada,grace" npm run scan:names
//   or a gitignored .scan-names file at the repo root, one name per line.
//
// The script refuses to run if .scan-names is tracked, since a scan whose input is
// committed publishes exactly what it exists to protect.
//
// Usage:  node scripts/scan-names.mjs
// Exit:   0 clean, 1 a name was found, 2 the scan could not run.
//
// Exit 2 is never a pass.

import { execFileSync, spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

// A token known to be present in this repo's history, used to prove the scan can
// find anything at all before it is allowed to report clean. "Gabriel" is the
// project's own pseudonymous identity: it is in the tree, in commit messages and in
// author metadata, so a run that fails to find it has not searched what it claims to.
const CONTROL_TOKEN = process.env.GABRIEL_SCAN_CONTROL || "Gabriel"

const NAMES_FILE = ".scan-names"

function fail(message) {
  console.error("scan-names: " + message)
  process.exit(2)
}

function git(args, options) {
  return execFileSync("git", args, Object.assign({ encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }, options || {}))
}

// ---------------------------------------------------------------------------
// Input: the names, from outside the repo
// ---------------------------------------------------------------------------

function readNames() {
  const fromEnv = (process.env.GABRIEL_SCAN_NAMES || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (fromEnv.length > 0) return fromEnv

  if (!existsSync(NAMES_FILE)) return []
  return readFileSync(NAMES_FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
}

if (existsSync(NAMES_FILE)) {
  let tracked = ""
  try {
    tracked = git(["ls-files", "--error-unmatch", "--", NAMES_FILE], { stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    tracked = ""
  }
  if (tracked.trim().length > 0) {
    fail(NAMES_FILE + " is TRACKED by git. That file is the scan's input and must never be committed. Remove it from the index before scanning.")
  }
}

const names = readNames()
if (names.length === 0) {
  fail("no names supplied. Set GABRIEL_SCAN_NAMES=\"first,second\" or create a gitignored " + NAMES_FILE + " with one name per line.")
}

// A one-character needle would match most of the object database and turn the scan
// into noise no one reads, which is the same failure as not running it.
for (const name of names) {
  if (name.length < 3) fail("the needle \"" + mask(name) + "\" is shorter than 3 characters; refusing to scan with it.")
}

// ---------------------------------------------------------------------------
// Reporting a hit without restating the name in the terminal transcript
// ---------------------------------------------------------------------------

function mask(name) {
  if (name.length <= 2) return "*".repeat(name.length)
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1] + " (" + name.length + ")"
}

// ---------------------------------------------------------------------------
// The needles. One name becomes several byte-level needles, because a name can reach
// the object database in more than one encoding and a scan that knows only UTF-8
// reports clean on a UTF-16 or accent-folded copy of the same string.
// ---------------------------------------------------------------------------

// The combining-mark range is BUILT rather than written as a regex literal, so this file
// stays pure ASCII on disk. This repo has a recorded history of byte-level corruption that
// every check above the byte layer reports as clean (see scan-nul.mjs), and a scanner is
// the last file that should carry non-ASCII bytes of its own.
const COMBINING_MARKS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g")
const stripAccents = (text) => text.normalize("NFD").replace(COMBINING_MARKS, "")

function needlesFor(name) {
  const lower = name.toLowerCase()
  return [lower, stripAccents(lower)].filter((needle, i, all) => all.indexOf(needle) === i)
}

// Three decodings of the same bytes, so one pass covers UTF-8/ASCII text, byte-preserving
// single-byte text, and UTF-16 (which SQLite may hold and which no UTF-8 scan can see).
function haystacksFor(body) {
  const utf8 = body.toString("utf8").toLowerCase()
  return [utf8, stripAccents(utf8), body.toString("latin1").toLowerCase(), body.toString("utf16le").toLowerCase()]
}

function bodyContains(body, needles) {
  const haystacks = haystacksFor(body)
  for (const needle of needles) {
    for (const haystack of haystacks) {
      if (haystack.includes(needle)) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// The sweep: every object in the database, not every file in the tree
// ---------------------------------------------------------------------------
//
// --batch-all-objects covers blobs (file contents), trees (which carry FILENAMES),
// commits (message plus author and committer identity) and annotated tags. It also
// covers unreachable objects, which a `git rev-list` walk misses and which a push of
// a rewritten branch can still carry. That is the whole object database in one pass.

function sweep(targets) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["cat-file", "--batch-all-objects", "--batch", "--buffer"], {
      stdio: ["ignore", "pipe", "inherit"],
    })

    let buffer = Buffer.alloc(0)
    let pending = null
    let objectCount = 0

    child.stdout.on("data", (chunk) => {
      buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk])

      for (;;) {
        if (pending == null) {
          const newline = buffer.indexOf(0x0a)
          if (newline < 0) break
          const header = buffer.subarray(0, newline).toString("utf8").split(" ")
          buffer = buffer.subarray(newline + 1)
          // "<oid> missing" has no body; anything else is "<oid> <type> <size>".
          if (header.length < 3) continue
          pending = { oid: header[0], type: header[1], size: Number(header[2]) }
          continue
        }

        if (buffer.length < pending.size + 1) break
        const body = buffer.subarray(0, pending.size)
        objectCount += 1
        for (const target of targets) {
          if (target.hits.length >= 20) continue
          if (bodyContains(body, target.needles)) target.hits.push({ oid: pending.oid, type: pending.type })
        }
        buffer = buffer.subarray(pending.size + 1)
        pending = null
      }
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("git cat-file exited " + String(code)))
        return
      }
      resolve(objectCount)
    })
  })
}

// ---------------------------------------------------------------------------

const targets = names.map((name) => ({ label: mask(name), needles: needlesFor(name), hits: [], control: false }))
const control = { label: "control token", needles: needlesFor(CONTROL_TOKEN), hits: [], control: true }

let objectCount = 0
try {
  objectCount = await sweep(targets.concat([control]))
} catch (error) {
  fail("the object sweep failed: " + String(error && error.message))
}

if (objectCount === 0) {
  fail("swept 0 objects. Refusing to report clean.")
}

// The scan proves itself before it is trusted. A sweep that reads every object and
// still cannot find a token known to be in history has not searched what it claims to,
// and its silence about the real names means nothing.
if (control.hits.length === 0) {
  fail(
    "self-check FAILED. Swept " +
      String(objectCount) +
      " objects without finding the control token \"" +
      CONTROL_TOKEN +
      "\", which is known to be in this repo's history. The scan is vacuous; refusing to report clean.",
  )
}

console.log("scan-names: swept " + String(objectCount) + " objects; self-check found the control token in " + String(control.hits.length) + " of them.")

const found = targets.filter((target) => target.hits.length > 0)

if (found.length > 0) {
  for (const target of found) {
    console.error("scan-names: FOUND " + target.label + " in " + String(target.hits.length) + (target.hits.length >= 20 ? "+ objects:" : " object(s):"))
    for (const hit of target.hits) {
      let where = ""
      try {
        // Names the commits that introduced or carry the object, so a hit is actionable
        // rather than an opaque oid. Only run on a hit, never on the clean path.
        where = git(["log", "--all", "--oneline", "--max-count=3", "--find-object=" + hit.oid], { stdio: ["ignore", "pipe", "ignore"] }).trim()
      } catch {
        where = ""
      }
      console.error("  " + hit.type + " " + hit.oid + (where.length > 0 ? "\n    " + where.split("\n").join("\n    ") : ""))
    }
  }
  console.error("scan-names: FAIL. Do not push. Rewriting history is the only fix once an object exists.")
  process.exit(1)
}

console.log("scan-names: clean, " + String(names.length) + " name(s) absent from all " + String(objectCount) + " objects.")

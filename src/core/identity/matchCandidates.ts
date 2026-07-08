import type { Entity } from "@/core/entity/entity"
import { normalizeForMatch } from "./transliterate"

/**
 * A proposed "these two records may be the same real-world entity" pair (ADR 0006, E3).
 * `proposeMatches` only *proposes*; a human confirms before `mergeEntities` runs — the
 * merge is destructive-ish (it collapses two records into one), so it is never automatic.
 */
export type MatchCandidate = {
  /** The two entity ids, always ordered by their position in the input array (a before b) for determinism. */
  aId: string
  bId: string
  /** Confidence in [0,1]. `1` = some normalized name/alias key is shared exactly. */
  score: number
  reason: "exact-normalized" | "similar-name"
}

/** Levenshtein edit distance between two strings (iterative two-row DP). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Normalized name similarity in [0,1]: `1 - editDistance / maxLength`. Two empty keys are not similar (0). */
export function nameSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - editDistance(a, b) / max
}

/**
 * The set of non-empty normalized keys for an entity: its name plus every alias.
 * Cached per entity object: `normalizeForMatch` (NFKD + several regex passes) is the hot
 * cost of a whole-project scan, and store entities are immutable (an update mints a new
 * object), so a WeakMap keyed by the object stays correct while re-using the work across
 * calls — only a *changed* entity re-normalizes, not the whole project on every mutation.
 */
const keyCache = new WeakMap<Entity, string[]>()
function matchKeys(entity: Entity): string[] {
  const cached = keyCache.get(entity)
  if (cached) return cached
  const keys = new Set<string>()
  for (const raw of [entity.name, ...(entity.aliases ?? [])]) {
    const key = normalizeForMatch(raw)
    if (key) keys.add(key)
  }
  const result = [...keys]
  keyCache.set(entity, result)
  return result
}

export type ProposeMatchesOptions = {
  /** Minimum `nameSimilarity` for a fuzzy (non-exact) candidate. Default 0.85. */
  threshold?: number
}

export const DEFAULT_MATCH_THRESHOLD = 0.85

/**
 * Scores one entity's keys against another's — the single source of truth both the
 * whole-project `proposeMatches` and the single-entity `matchesForEntity` share: any exactly
 * shared key ⇒ `exact-normalized` (score 1); otherwise the best `nameSimilarity`, kept only
 * if it clears `threshold` (`similar-name`). Returns `null` for no match.
 */
function scoreKeys(
  aKeys: string[],
  bKeys: string[],
  threshold: number,
): { score: number; reason: MatchCandidate["reason"] } | null {
  if (!aKeys.length || !bKeys.length) return null
  const bKeySet = new Set(bKeys)
  if (aKeys.some((k) => bKeySet.has(k))) return { score: 1, reason: "exact-normalized" }
  let best = 0
  for (const ak of aKeys) for (const bk of bKeys) best = Math.max(best, nameSimilarity(ak, bk))
  return best >= threshold ? { score: best, reason: "similar-name" } : null
}

/**
 * Proposes duplicate candidates across `entities`, comparing normalized name/alias keys.
 * Only same-`kind` pairs are considered (a unit and a corporate record are never "the same
 * real-world entity"). A pair with any shared key scores `1` (`exact-normalized`); otherwise
 * the best cross-key similarity is used and the pair is kept only if it clears `threshold`
 * (`similar-name`). Deterministic: candidates are sorted by score desc, then aId, then bId.
 */
export function proposeMatches(entities: Entity[], options: ProposeMatchesOptions = {}): MatchCandidate[] {
  const threshold = options.threshold ?? DEFAULT_MATCH_THRESHOLD
  const keysById = new Map(entities.map((e) => [e.id, matchKeys(e)]))
  const candidates: MatchCandidate[] = []

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i]
      const b = entities[j]
      if (a.kind !== b.kind) continue
      const scored = scoreKeys(keysById.get(a.id)!, keysById.get(b.id)!, threshold)
      if (scored) candidates.push({ aId: a.id, bId: b.id, ...scored })
    }
  }

  return candidates.sort((x, y) => y.score - x.score || cmp(x.aId, y.aId) || cmp(x.bId, y.bId))
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Duplicate candidates for a single `entity` against `others` — the O(n) query the inspector
 * needs ("what might this selected entity be a duplicate of?"), rather than the O(n²)
 * whole-project `proposeMatches`. `aId` is always `entity.id`; results are sorted by score desc.
 */
export function matchesForEntity(entity: Entity, others: Entity[], options: ProposeMatchesOptions = {}): MatchCandidate[] {
  const threshold = options.threshold ?? DEFAULT_MATCH_THRESHOLD
  const aKeys = matchKeys(entity)
  if (!aKeys.length) return []
  const candidates: MatchCandidate[] = []

  for (const other of others) {
    if (other.id === entity.id || other.kind !== entity.kind) continue
    const scored = scoreKeys(aKeys, matchKeys(other), threshold)
    if (scored) candidates.push({ aId: entity.id, bId: other.id, ...scored })
  }

  return candidates.sort((x, y) => y.score - x.score || cmp(x.bId, y.bId))
}

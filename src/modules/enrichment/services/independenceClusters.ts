/**
 * ADR 0009: independence is measured as distinct corroboration clusters, not URL
 * count — near-duplicate text (wire syndication, cross-posting) and interested-party
 * sources on the same side collapse to a single origin *before* counting, so
 * circular reporting can't manufacture false confirmation. Phase 5 (v1.5): matching is
 * k-shingle MinHash rather than bag-of-words overlap — it approximates similarity over
 * word *sequences*, so it's harder to fool with shared vocabulary in a different order
 * than plain token Jaccard, and it's the same algorithm literature uses for
 * near-duplicate detection at scale. It still runs over whatever text is available
 * (today, retrieval snippets) — MinHash over *full article bodies* needs a body-fetch
 * capability Gabriel's retrieval pipeline doesn't have; this is the algorithm upgrade
 * the ADR asked for, applied to the text actually on hand.
 */
export type ClusterableCitation = {
  url: string
  snippet: string
  interestedParty?: boolean
}

/**
 * Calibrated against shingle-level (not word-bag) similarity, which runs lower for the
 * same real-world threat: near-verbatim wire mirrors with light lead/attribution
 * rewording score ~0.5-0.8 here; genuinely unrelated text scores ~0.
 */
const NEAR_DUPLICATE_THRESHOLD = 0.45
const SHINGLE_SIZE = 3
const HASH_COUNT = 48
/** Fixed, deterministic seeds (odd constants) — same signature for the same text on every run, which round-trip tests and CI depend on. */
const HASH_SEEDS = Array.from({ length: HASH_COUNT }, (_, i) => (0x9e3779b1 ^ Math.imul(i + 1, 0x85ebca77)) >>> 0)

function normalizeSnippet(snippet: string): string {
  return snippet
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Word k-shingles (contiguous phrases), not character n-grams — captures phrase-level copying, which is what wire syndication actually reproduces. Falls back to the whole (short) text as a single shingle so brief snippets still compare. */
function shingles(text: string): string[] {
  const tokens = normalizeSnippet(text).split(" ").filter(Boolean)
  if (tokens.length === 0) return []
  if (tokens.length < SHINGLE_SIZE) return [tokens.join(" ")]
  const result: string[] = []
  for (let i = 0; i <= tokens.length - SHINGLE_SIZE; i += 1) {
    result.push(tokens.slice(i, i + SHINGLE_SIZE).join(" "))
  }
  return result
}

/** FNV-1a-style 32-bit string hash, mixed with a seed — deterministic, no external dependency. */
function hash32(str: string, seed: number): number {
  let h = (seed ^ 0x811c9dc5) >>> 0
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The MinHash signature: for each seeded hash function, the minimum hash over every shingle. Two texts sharing more shingles agree on more signature slots. */
function minhashSignature(shingleList: string[]): number[] {
  const signature = new Array<number>(HASH_COUNT).fill(Number.POSITIVE_INFINITY)
  for (const shingle of shingleList) {
    for (let i = 0; i < HASH_COUNT; i += 1) {
      const h = hash32(shingle, HASH_SEEDS[i]!)
      if (h < signature[i]!) signature[i] = h
    }
  }
  return signature
}

/** Fraction of matching signature slots — an unbiased estimator of the shingle sets' true Jaccard similarity. */
function signatureSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let matches = 0
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) matches += 1
  }
  return matches / a.length
}

/**
 * Groups citations into corroboration clusters: every interested-party citation
 * collapses into one shared "origin" cluster (they're a party to what they report,
 * so many interested-party voices still count as one), and every other citation
 * joins the first existing cluster whose representative snippet is a near-duplicate
 * of its own, or starts a new cluster otherwise. Each citation's MinHash signature is
 * computed once (not per comparison) — O(n) signatures, not O(n²).
 */
export function clusterCitations(citations: ClusterableCitation[]): ClusterableCitation[][] {
  const clusters: ClusterableCitation[][] = []
  const clusterSignatures: number[][] = []
  const interestedPartyCluster: ClusterableCitation[] = []

  for (const citation of citations) {
    if (citation.interestedParty) {
      interestedPartyCluster.push(citation)
      continue
    }
    const signature = minhashSignature(shingles(citation.snippet))
    const matchIndex = clusterSignatures.findIndex(
      (existing) => signatureSimilarity(existing, signature) >= NEAR_DUPLICATE_THRESHOLD,
    )
    if (matchIndex >= 0) {
      clusters[matchIndex]!.push(citation)
    } else {
      clusters.push([citation])
      clusterSignatures.push(signature)
    }
  }

  if (interestedPartyCluster.length > 0) clusters.push(interestedPartyCluster)
  return clusters
}

export function countCorroborationClusters(citations: ClusterableCitation[]): number {
  return clusterCitations(citations).length
}

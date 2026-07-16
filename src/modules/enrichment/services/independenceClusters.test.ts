import { describe, expect, it } from "vitest"
import { clusterCitations, countCorroborationClusters, type ClusterableCitation } from "./independenceClusters"

describe("clusterCitations", () => {
  it("puts each citation with a distinct snippet in its own cluster", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://a.example", snippet: "Brigade relocated to Voronezh region last month." },
      { url: "https://b.example", snippet: "Local officials confirmed a new stadium opening." },
    ]
    expect(clusterCitations(citations)).toHaveLength(2)
  })

  it("collapses near-duplicate snippets (wire syndication) into one cluster", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://ap.example/a", snippet: "The 42nd Motor Rifle Division redeployed to the border region on Tuesday." },
      { url: "https://mirror.example/b", snippet: "The 42nd Motor Rifle Division redeployed to the border region on Tuesday, officials said." },
    ]
    const clusters = clusterCitations(citations)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(2)
  })

  it("collapses every interested-party citation into a single origin regardless of snippet text", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://tass.example/a", snippet: "Completely unrelated wording one.", interestedParty: true },
      { url: "https://ria.example/b", snippet: "Completely unrelated wording two.", interestedParty: true },
    ]
    const clusters = clusterCitations(citations)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toHaveLength(2)
  })

  it("keeps an interested-party citation out of a non-interested cluster even with a matching snippet", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://tass.example/a", snippet: "The ministry announced a new offensive today." },
      { url: "https://independent.example/b", snippet: "The ministry announced a new offensive today.", interestedParty: true },
    ]
    const clusters = clusterCitations([{ ...citations[0]!, interestedParty: true }, citations[1]!])
    expect(clusters).toHaveLength(1)
  })

  it("returns no clusters for an empty citation list", () => {
    expect(clusterCitations([])).toEqual([])
  })

  it("keeps snippet-less citations as distinct clusters instead of collapsing them into one", () => {
    // No snippet text = no evidence of shared origin; each must count as its own cluster,
    // else 3 independent sources lacking snippets are under-credited as a single cluster.
    const citations: ClusterableCitation[] = [
      { url: "https://a.example", snippet: "" },
      { url: "https://b.example", snippet: "   " },
      { url: "https://c.example", snippet: "" },
    ]
    expect(clusterCitations(citations)).toHaveLength(3)
  })

  it("does not match a snippet-less citation against one with real text", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://a.example", snippet: "The brigade redeployed to the border region overnight." },
      { url: "https://b.example", snippet: "" },
    ]
    expect(clusterCitations(citations)).toHaveLength(2)
  })
})

describe("countCorroborationClusters", () => {
  it("returns the number of clusters, not the number of URLs", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://ap.example/a", snippet: "Wire dispatch about the deployment reaching multiple outlets." },
      { url: "https://mirror1.example/b", snippet: "Wire dispatch about the deployment reaching multiple outlets." },
      { url: "https://mirror2.example/c", snippet: "Wire dispatch about the deployment reaching multiple outlets." },
    ]
    expect(countCorroborationClusters(citations)).toBe(1)
  })

  it("Phase 5: a wire-syndicated dispatch reposted, lightly reworded, across many domains still collapses to one cluster", () => {
    const dispatch =
      "Ukrainian officials reported that the 42nd Motor Rifle Division redeployed to the northern border region overnight, citing satellite imagery and local witness accounts."
    const rewordedMirrors = [
      "Ukrainian officials reported that the 42nd Motor Rifle Division redeployed to the northern border region overnight, according to satellite imagery and witness accounts.",
      "According to Ukrainian officials, the 42nd Motor Rifle Division redeployed to the northern border region overnight — satellite imagery and local witness accounts cited.",
      "Officials in Ukraine reported that the 42nd Motor Rifle Division redeployed to the northern border region overnight, citing satellite imagery and local witness accounts.",
      "The 42nd Motor Rifle Division redeployed to the northern border region overnight, Ukrainian officials reported, citing satellite imagery and local witnesses.",
      "Reuters wire: Ukrainian officials reported that the 42nd Motor Rifle Division redeployed to the northern border region overnight, citing satellite imagery and local witness accounts.",
    ]
    const citations: ClusterableCitation[] = [dispatch, ...rewordedMirrors].map((snippet, i) => ({
      url: `https://outlet-${i}.example/article`,
      snippet,
    }))
    expect(countCorroborationClusters(citations)).toBe(1)
  })

  it("Phase 5: does not collapse two genuinely distinct, unrelated reports into one cluster", () => {
    const citations: ClusterableCitation[] = [
      { url: "https://a.example", snippet: "Ukrainian officials reported that the 42nd Motor Rifle Division redeployed to the northern border region overnight, citing satellite imagery and local witness accounts." },
      { url: "https://b.example", snippet: "A new stadium construction project was approved by the regional council on Thursday, with completion expected in 2027." },
    ]
    expect(countCorroborationClusters(citations)).toBe(2)
  })
})

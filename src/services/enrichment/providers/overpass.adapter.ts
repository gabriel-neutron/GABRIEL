import type { ProviderSearchResult } from "@/types/enrichment.types"
import type { RetrievalAdapter } from "./provider.types"

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"

export class OverpassAdapter implements RetrievalAdapter {
  name = "overpass"

  async search(query: string, signal?: AbortSignal): Promise<ProviderSearchResult[]> {
    const overpassQuery = `[out:json][timeout:10];node["name"~"${query.replace(/"/g, '\\"')}",i]["military"];out body 3;`
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: overpassQuery,
      signal,
    })
    if (!response.ok) {
      throw new Error(`Overpass query failed (${response.status})`)
    }
    const payload = (await response.json()) as {
      elements?: Array<{
        id?: number
        type?: string
        tags?: Record<string, string>
      }>
    }
    return (payload.elements ?? []).slice(0, 3).map((element) => ({
      url: `https://www.openstreetmap.org/${element.type ?? "node"}/${element.id ?? 0}`,
      title: element.tags?.name ?? "OSM military object",
      snippet: JSON.stringify(element.tags ?? {}),
    }))
  }
}


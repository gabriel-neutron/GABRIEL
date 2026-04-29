import { useEffect, useMemo, useState } from "react"
import { fetchOsmObjectDetails, type OsmObjectDetails } from "@/services/overpass.service"
import { OsmObjectDetailsView } from "./OsmObjectDetailsView"

const META_KEYS = new Set([
  "id", "type", "relations", "geometry", "meta",
  "version", "changeset", "timestamp", "user",
])

function detailsFromCachedFeature(
  type: "node" | "way" | "relation",
  id: number,
  feature: GeoJSON.Feature & { id?: string },
): OsmObjectDetails {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const meta = (props.meta as Record<string, unknown>) ?? {}
  let tags: Record<string, string>

  if (props.tags && typeof props.tags === "object" && !Array.isArray(props.tags)) {
    tags = {}
    for (const [k, v] of Object.entries(props.tags as object)) {
      if (typeof v === "string") tags[k] = v
    }
  } else {
    tags = {}
    for (const [k, v] of Object.entries(props)) {
      if (META_KEYS.has(k)) continue
      if (typeof v === "string") tags[k] = v
    }
  }

  return {
    type,
    id,
    version: ((meta.version ?? props.version) as number) ?? 0,
    changeset: ((meta.changeset ?? props.changeset) as number) ?? 0,
    timestamp: ((meta.timestamp ?? props.timestamp) as string) ?? "",
    user: ((meta.user ?? props.user) as string) ?? "",
    tags,
  }
}

type Props = {
  type: "node" | "way" | "relation"
  id: number
  cachedFeature?: GeoJSON.Feature & { id?: string }
}

export function OsmObjectInspector({ type, id, cachedFeature }: Props) {
  const cacheDetails = useMemo(
    () => (cachedFeature ? detailsFromCachedFeature(type, id, cachedFeature) : null),
    [type, id, cachedFeature],
  )

  const [remoteDetails, setRemoteDetails] = useState<OsmObjectDetails | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(cacheDetails === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cacheDetails !== null) {
      return
    }

    const controller = new AbortController()
    setLoadingRemote(true)
    setError(null)
    setRemoteDetails(null)
    fetchOsmObjectDetails(type, id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setRemoteDetails(data)
      })
      .catch((e) => {
        if (e?.name === "AbortError") return
        setError(e instanceof Error ? e.message : "Failed to fetch OSM object details")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRemote(false)
      })
    return () => controller.abort()
  }, [cacheDetails, type, id])

  const details = cacheDetails ?? remoteDetails
  const loading = cacheDetails === null && loadingRemote

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-sm">
        <p className="text-destructive">Error loading OSM object</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        No data available
      </div>
    )
  }

  return <OsmObjectDetailsView details={details} />
}

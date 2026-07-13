import { useEffect, useMemo, useState } from "react"
import { Button } from "@/ui/button"
import { Field, FieldLabel } from "@/ui/field"
import { fetchOsmObjectDetails, type OsmObjectDetails } from "@/modules/osm/services/overpass.service"

const META_KEYS = new Set([
  "id",
  "type",
  "relations",
  "geometry",
  "meta",
  "version",
  "changeset",
  "timestamp",
  "user",
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

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "Unknown"
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp))
  } catch {
    return timestamp
  }
}

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "Unknown"
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime()
    const diffDays = Math.floor(diffMs / 86_400_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffMinutes = Math.floor(diffMs / 60_000)
    if (diffDays > 0) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`
    if (diffHours > 0) return `Il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`
    if (diffMinutes > 0) return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`
    return "À l'instant"
  } catch {
    return timestamp
  }
}

function getOsmObjectName(details: OsmObjectDetails): string {
  return (
    details.tags.name ??
    details.tags["name:en"] ??
    details.tags["name:fr"] ??
    `${details.type} ${details.id}`
  )
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

  const typeLabel = details.type.charAt(0).toUpperCase() + details.type.slice(1)
  const objectName = getOsmObjectName(details)
  const tagEntries = Object.entries(details.tags).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-4 overflow-auto p-4">
      <h2 className="text-lg font-semibold">
        {typeLabel}: {objectName} ({details.id})
      </h2>

      {(details.version > 0 || details.tags["comment"]) && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {details.version > 0 && <p>Version #{details.version}</p>}
          {details.tags["comment"] && <p>{details.tags["comment"]}</p>}
        </div>
      )}

      {(details.timestamp || details.user || details.changeset > 0) && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {(details.timestamp || details.user) && (
            <p>
              Modifie {formatRelativeTime(details.timestamp)} par {details.user || "Unknown"}
            </p>
          )}
          {details.changeset > 0 && <p>Groupe de modifications #{details.changeset}</p>}
          {details.timestamp && <p className="text-xs">{formatTimestamp(details.timestamp)}</p>}
        </div>
      )}

      <Field>
        <FieldLabel>Attributs</FieldLabel>
        {tagEntries.length === 0 ? (
          <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
            No tags
          </div>
        ) : (
          <div className="overflow-hidden rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">key</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">value</th>
                </tr>
              </thead>
              <tbody>
                {tagEntries.map(([key, value]) => (
                  <tr key={key} className="border-t">
                    <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{key}</td>
                    <td className="px-2 py-1.5 break-words">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Field>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => window.open(`https://www.openstreetmap.org/${details.type}/${details.id}`, "_blank")}
      >
        View on OpenStreetMap
      </Button>
    </div>
  )
}

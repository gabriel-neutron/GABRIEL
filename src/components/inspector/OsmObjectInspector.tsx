import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { fetchOsmObjectDetails, type OsmObjectDetails } from "@/services/overpass.service"

type Props = {
  type: "node" | "way" | "relation"
  id: number
  /** When present, use this instead of fetching (data already in OSM layer). */
  cachedFeature?: GeoJSON.Feature & { id?: string }
}

const META_KEYS = new Set(["id", "type", "relations", "geometry", "meta", "version", "changeset", "timestamp", "user"])

/** Build OsmObjectDetails from a GeoJSON feature produced by osmtogeojson (flat or nested properties). */
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
    for (const [k, v] of Object.entries(props.tags)) {
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
    version: (meta.version ?? props.version) as number ?? 0,
    changeset: (meta.changeset ?? props.changeset) as number ?? 0,
    timestamp: (meta.timestamp ?? props.timestamp) as string ?? "",
    user: (meta.user ?? props.user) as string ?? "",
    tags,
  }
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "Unknown"
  try {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  } catch {
    return timestamp
  }
}

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "Unknown"
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`
    } else if (diffHours > 0) {
      return `Il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`
    } else if (diffMinutes > 0) {
      return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`
    } else {
      return "À l'instant"
    }
  } catch {
    return timestamp
  }
}

function getOsmObjectName(details: OsmObjectDetails): string {
  return details.tags.name ?? details.tags["name:en"] ?? details.tags["name:fr"] ?? `${details.type} ${details.id}`
}

function getOsmObjectUrl(type: "node" | "way" | "relation", id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`
}

export function OsmObjectInspector({ type, id, cachedFeature }: Props) {
  const [details, setDetails] = useState<OsmObjectDetails | null>(() =>
    cachedFeature ? detailsFromCachedFeature(type, id, cachedFeature) : null,
  )
  const [loading, setLoading] = useState(!cachedFeature)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedFeature) {
      setDetails(detailsFromCachedFeature(type, id, cachedFeature))
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setDetails(null)
    fetchOsmObjectDetails(type, id)
      .then(setDetails)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to fetch OSM object details"))
      .finally(() => setLoading(false))
  }, [type, id, cachedFeature])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-sm text-destructive">
        <p className="mb-2">Error loading OSM object</p>
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

  const objectName = getOsmObjectName(details)
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
  const tagEntries = Object.entries(details.tags).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex h-full min-w-0 flex-col p-4">
      <div className="min-h-0 space-y-4 overflow-auto">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            {typeLabel}: {objectName} ({id})
          </h2>
        </div>

        {(details.version > 0 || details.tags["comment"]) && (
          <div className="space-y-2">
            {details.version > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Version #{details.version}</span>
              </div>
            )}
            {details.tags["comment"] && (
              <div className="text-sm text-muted-foreground">{details.tags["comment"]}</div>
            )}
          </div>
        )}

        {(details.timestamp || details.user || details.changeset > 0) && (
          <div className="space-y-2">
            {(details.timestamp || details.user) && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Modifié {formatRelativeTime(details.timestamp)} par {details.user || "Unknown"}
                </span>
              </div>
            )}
            {details.changeset > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Groupe de modifications #{details.changeset}</span>
              </div>
            )}
            {details.timestamp && (
              <div className="text-xs text-muted-foreground">
                {formatTimestamp(details.timestamp)}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Attributs</Label>
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
        </div>

        <div className="pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              window.open(getOsmObjectUrl(type, id), "_blank")
            }}
          >
            View on OpenStreetMap
          </Button>
        </div>
      </div>
    </div>
  )
}

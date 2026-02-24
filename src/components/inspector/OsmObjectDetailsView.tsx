import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import type { OsmObjectDetails } from "@/services/overpass.service"

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

function getOsmObjectUrl(type: "node" | "way" | "relation", id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`
}

type Props = {
  details: OsmObjectDetails
}

export function OsmObjectDetailsView({ details }: Props) {
  const { type, id } = details
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
  const objectName = getOsmObjectName(details)
  const tagEntries = Object.entries(details.tags).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-4 overflow-auto p-4">
      <h2 className="text-lg font-semibold">
        {typeLabel}: {objectName} ({id})
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
              Modifié {formatRelativeTime(details.timestamp)} par {details.user || "Unknown"}
            </p>
          )}
          {details.changeset > 0 && <p>Groupe de modifications #{details.changeset}</p>}
          {details.timestamp && (
            <p className="text-xs">{formatTimestamp(details.timestamp)}</p>
          )}
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
        onClick={() => window.open(getOsmObjectUrl(type, id), "_blank")}
      >
        View on OpenStreetMap
      </Button>
    </div>
  )
}
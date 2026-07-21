import { useEffect, useState } from "react"
import { Button } from "@/ui/button"
import {
  decideOobProposal,
  fetchOobProposals,
  type OobProposal,
} from "@/modules/telegram/services/sidecar.service"
import { appendTelegramSourceToEntity } from "@/modules/telegram/services/appendTelegramSource"

/**
 * Phase 7 review queue UI. Pending proposals come from `GET /oob/proposals` — populated
 * by `POST /oob/propose-from-gpkg` (not yet wired to any automated trigger, since real
 * candidates need Phase 5's crawl output feeding real extracted unit names). This panel
 * works today against manually-created proposals for testing/demo purposes.
 *
 * On accept: writes the channel URL onto the matched entity as a citation
 * (`appendTelegramSourceToEntity` — Source+Claim, same pattern as the existing "add
 * source" UI) and reminds the analyst to Save. Does not save automatically — only
 * `EditPage`'s `useProjectIO` may call `saveGeoPackage` (I/O gating, CLAUDE.md); this
 * only stages the change in the entity/provenance stores for the next explicit Save,
 * same as any other manual edit elsewhere in the app.
 */
export function OobProposals() {
  const [proposals, setProposals] = useState<OobProposal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null)

  async function refresh() {
    try {
      setProposals(await fetchOobProposals())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDecision(id: number, decision: "accept" | "reject") {
    try {
      const result = await decideOobProposal(id, decision)
      if (decision === "accept" && result) {
        appendTelegramSourceToEntity(result.oob_entity_id, result.channel_url)
        setAcceptedMessage(`Added ${result.channel_url} as a source — click Save to write it to the .gpkg.`)
      }
      setProposals((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return <p className="p-3 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {acceptedMessage && <p className="px-3 pt-3 text-sm text-muted-foreground">{acceptedMessage}</p>}
      {proposals.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">No pending OOB match proposals.</p>
      )}
      <ul className="flex flex-col gap-2 p-3 pt-0">
        {proposals.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 rounded border p-2">
            <p className="text-sm">{p.evidence_text}</p>
            <p className="text-xs text-muted-foreground">
              confidence {p.confidence.toFixed(2)} · @{p.username}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleDecision(p.id, "accept")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDecision(p.id, "reject")}>
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

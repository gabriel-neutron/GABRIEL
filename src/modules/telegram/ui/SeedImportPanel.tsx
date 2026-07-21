import { useState } from "react"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { importSeeds } from "@/modules/telegram/services/sidecar.service"

/**
 * FR-1 seed import — `leftPanels` entry. Deliberately does not include crawl
 * start/pause/resume controls: BFS discovery (Phase 5) calls Telegram and is still
 * gated on Phase 1's validation exit criteria (docs/timelines/TELEGRAM_TIMELINE.md).
 * This panel only writes `status=seed` rows via the sidecar — no Telegram call.
 */
export function SeedImportPanel() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "done"; inserted: number; requested: number } | { kind: "error"; message: string }
  >({ kind: "idle" })

  async function handleImport() {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return

    setStatus({ kind: "loading" })
    try {
      const result = await importSeeds({ usernames: lines })
      setStatus({ kind: "done", inserted: result.inserted, requested: result.requested })
      setText("")
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-sm text-muted-foreground">
        One channel username per line (with or without @). Adds each as a seed —
        collection happens in a later phase, this only registers them.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"rybar\nwargonzo"}
        rows={6}
      />
      <Button onClick={handleImport} disabled={status.kind === "loading" || !text.trim()}>
        {status.kind === "loading" ? "Importing…" : "Import seeds"}
      </Button>
      {status.kind === "done" && (
        <p className="text-sm text-muted-foreground">
          Imported {status.inserted} of {status.requested} (duplicates skipped).
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-sm text-destructive">
          {status.message} — is the sidecar running? (`npm run sidecar`)
        </p>
      )}
    </div>
  )
}

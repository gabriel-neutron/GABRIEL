import { useSidecarHealthPoll } from "@/modules/telegram/hooks/useSidecarHealthPoll"
import { useTelegramStore } from "@/modules/telegram/store/useTelegramStore"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  checking: "Checking Telegram sidecar…",
  reachable: "Telegram sidecar reachable",
  unreachable: "Telegram sidecar unreachable — run `npm run sidecar`",
}

/**
 * Sidecar connection-status dot (Phase 2 exit criterion, ADR 0007 — a module's own
 * async status UI is just a headerContribution component doing its own polling, no
 * shell support needed). Green when the sidecar answers `/health` and reports a
 * connected Telegram session, amber when reachable but Telegram isn't authenticated,
 * red when the sidecar itself can't be reached.
 */
export function SidecarStatusIndicator() {
  useSidecarHealthPoll()
  const connectionStatus = useTelegramStore((s) => s.connectionStatus)
  const health = useTelegramStore((s) => s.health)

  const color =
    connectionStatus === "reachable"
      ? health?.telegram === "connected"
        ? "bg-green-500"
        : "bg-amber-500"
      : connectionStatus === "checking"
        ? "bg-muted-foreground"
        : "bg-red-500"

  const label =
    connectionStatus === "reachable" && health
      ? health.telegram === "connected"
        ? "Telegram sidecar connected"
        : "Telegram sidecar reachable, not authenticated"
      : STATUS_LABEL[connectionStatus]

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm" title={label}>
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      <span>Telegram sidecar</span>
    </div>
  )
}

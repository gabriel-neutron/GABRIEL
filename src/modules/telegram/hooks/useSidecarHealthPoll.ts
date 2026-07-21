import { useEffect } from "react"
import { fetchSidecarHealth } from "@/modules/telegram/services/sidecar.service"
import { useTelegramStore } from "@/modules/telegram/store/useTelegramStore"

const POLL_INTERVAL_MS = 10_000

/** Polls `/health` on an interval and keeps `useTelegramStore.connectionStatus` current. */
export function useSidecarHealthPoll(): void {
  const setHealth = useTelegramStore((s) => s.setHealth)
  const setUnreachable = useTelegramStore((s) => s.setUnreachable)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const health = await fetchSidecarHealth()
        if (!cancelled) setHealth(health)
      } catch {
        if (!cancelled) setUnreachable()
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [setHealth, setUnreachable])
}

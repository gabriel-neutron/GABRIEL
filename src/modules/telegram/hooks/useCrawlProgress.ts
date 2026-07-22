import { useEffect, useState } from "react"
import { connectCrawlProgress } from "@/modules/telegram/services/crawlProgressConnection"
import type { CrawlProgressMessage } from "@/modules/telegram/services/sidecar.service"

export type CrawlProgressState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "live"; message: CrawlProgressMessage }
  | { kind: "error"; message: string }

/** Thin React wrapper around `connectCrawlProgress` (Slice 7) — `sessionId === null`
 * means "not attached to a crawl," matching the graph view's default (no live crawl
 * running). Tears down the WS connection on unmount or session-id change; the
 * connection's own reconnect-on-drop logic lives in `crawlProgressConnection.ts`, not
 * here, so it's covered by that module's own tests. */
export function useCrawlProgress(sessionId: number | null): CrawlProgressState {
  const [state, setState] = useState<CrawlProgressState>(sessionId === null ? { kind: "idle" } : { kind: "connecting" })

  useEffect(() => {
    if (sessionId === null) {
      setState({ kind: "idle" })
      return
    }
    setState({ kind: "connecting" })
    const connection = connectCrawlProgress(sessionId, {
      onMessage: (message) => setState({ kind: "live", message }),
      onError: (error) => setState({ kind: "error", message: error.error }),
    })
    return () => connection.close()
  }, [sessionId])

  return state
}

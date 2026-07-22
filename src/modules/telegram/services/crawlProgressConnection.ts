import {
  crawlWebSocketUrl,
  type CrawlProgressError,
  type CrawlProgressMessage,
} from "@/modules/telegram/services/sidecar.service"

/** The subset of the browser `WebSocket` interface this module actually uses — narrow
 * enough that tests can implement a fake without pulling in a real socket/jsdom. */
export type MinimalWebSocket = {
  onmessage: ((event: { data: string }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  close: () => void
}

export type WebSocketFactory = (url: string) => MinimalWebSocket

const DEFAULT_RECONNECT_DELAY_MS = 2000

export type CrawlProgressHandlers = {
  onMessage: (message: CrawlProgressMessage) => void
  onError: (error: CrawlProgressError) => void
}

export type CrawlProgressConnection = { close: () => void }

/** Narrows an untyped WS payload before it's routed to a handler — this crosses a
 * network boundary (the sidecar process), so a cast alone isn't enough to trust the
 * shape the way an internal call would be. */
function isCrawlProgressPayload(value: unknown): value is CrawlProgressMessage | CrawlProgressError {
  return typeof value === "object" && value !== null && "session_id" in value
}

/**
 * Owns WS connection lifecycle for one crawl session (Slice 7,
 * docs/issues/TELEGRAM_PHASE3_ISSUES.md): reconnects after `reconnectDelayMs` on an
 * unexpected close (network blip, sidecar restart mid-crawl), and never reconnects once
 * `close()` has been called explicitly (component unmount, or the caller switched to a
 * different session) — a stray reconnect timer firing after that would leak a socket and
 * call a handler the caller no longer wants delivered. Reconnecting only re-opens the
 * socket; it never touches the sidecar's crawl state (`crawl_ws.py`'s docstring) — the
 * crawl this streams from doesn't know or care whether anything is connected.
 *
 * `webSocketFactory` defaults to the real `WebSocket` constructor but is injectable so
 * this can be unit-tested with a fake socket and no real network (see
 * `crawlProgressConnection.test.ts`), matching `enrichmentRunner.ts`'s pattern of
 * injecting the one impure dependency rather than mocking a global.
 */
export function connectCrawlProgress(
  sessionId: number,
  handlers: CrawlProgressHandlers,
  options: { webSocketFactory?: WebSocketFactory; reconnectDelayMs?: number } = {},
): CrawlProgressConnection {
  const webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url) as unknown as MinimalWebSocket)
  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS

  let closedByCaller = false
  let socket: MinimalWebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    const ws = webSocketFactory(crawlWebSocketUrl(sessionId))
    socket = ws
    ws.onmessage = (event) => {
      const parsed: unknown = JSON.parse(event.data)
      if (!isCrawlProgressPayload(parsed)) return
      if ("error" in parsed) {
        handlers.onError(parsed)
      } else {
        handlers.onMessage(parsed)
      }
    }
    ws.onclose = () => {
      if (!closedByCaller) {
        reconnectTimer = setTimeout(connect, reconnectDelayMs)
      }
    }
    ws.onerror = () => {
      ws.close()
    }
  }

  connect()

  return {
    close: () => {
      closedByCaller = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      socket?.close()
    },
  }
}

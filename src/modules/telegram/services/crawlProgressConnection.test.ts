import { describe, expect, it } from "vitest"
import { connectCrawlProgress, type MinimalWebSocket } from "./crawlProgressConnection"
import type { CrawlProgressMessage } from "./sidecar.service"

function makeMessage(overrides: Partial<CrawlProgressMessage> = {}): CrawlProgressMessage {
  return {
    session_id: 1,
    status: "running",
    frontier_size: 3,
    visited_count: 2,
    node_count: 5,
    edge_count: 4,
    ...overrides,
  }
}

class FakeSocket implements MinimalWebSocket {
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  close() {
    this.closed = true
    this.onclose?.()
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

function fakeSocketFactory(sockets: FakeSocket[]) {
  return () => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  }
}

describe("connectCrawlProgress", () => {
  it("delivers parsed progress messages via onMessage", () => {
    const sockets: FakeSocket[] = []
    const received: CrawlProgressMessage[] = []

    connectCrawlProgress(
      1,
      { onMessage: (m) => received.push(m), onError: () => {} },
      { webSocketFactory: fakeSocketFactory(sockets) },
    )

    sockets[0].emitMessage(makeMessage({ node_count: 7 }))

    expect(received).toEqual([makeMessage({ node_count: 7 })])
  })

  it("routes error-shaped payloads to onError instead of onMessage", () => {
    const sockets: FakeSocket[] = []
    const errors: unknown[] = []
    const received: CrawlProgressMessage[] = []

    connectCrawlProgress(
      1,
      { onMessage: (m) => received.push(m), onError: (e) => errors.push(e) },
      { webSocketFactory: fakeSocketFactory(sockets) },
    )

    sockets[0].emitMessage({ error: "session_not_found", session_id: 1 })

    expect(errors).toEqual([{ error: "session_not_found", session_id: 1 }])
    expect(received).toEqual([])
  })

  it("reconnects with a new socket after an unexpected close", async () => {
    const sockets: FakeSocket[] = []

    connectCrawlProgress(
      1,
      { onMessage: () => {}, onError: () => {} },
      { webSocketFactory: fakeSocketFactory(sockets), reconnectDelayMs: 1 },
    )

    expect(sockets).toHaveLength(1)
    sockets[0].onclose?.() // simulate the browser firing close on a dropped connection

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sockets).toHaveLength(2)
  })

  it("does not reconnect after close() was called explicitly", async () => {
    const sockets: FakeSocket[] = []

    const connection = connectCrawlProgress(
      1,
      { onMessage: () => {}, onError: () => {} },
      { webSocketFactory: fakeSocketFactory(sockets), reconnectDelayMs: 1 },
    )

    connection.close()
    expect(sockets[0].closed).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sockets).toHaveLength(1)
  })
})

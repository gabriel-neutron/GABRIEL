/**
 * Synthetic graphology graph for the Phase 1 Sigma.js performance validation
 * (docs/timelines/TELEGRAM_TIMELINE.md — no Telegram credentials needed, mock data only).
 * Also reusable as fixture data for Phase 6 UI work. No React; pure function.
 */

import Graph from "graphology"

export function buildMockChannelGraph(nodeCount: number, avgDegree = 4): Graph {
  const graph = new Graph()

  for (let i = 0; i < nodeCount; i++) {
    graph.addNode(`channel-${i}`, {
      label: `Channel ${i}`,
      size: 3 + Math.random() * 5,
      color: Math.random() > 0.8 ? "#ef4444" : "#3b82f6",
      x: Math.random() * 100,
      y: Math.random() * 100,
    })
  }

  const edgeCount = Math.floor((nodeCount * avgDegree) / 2)
  for (let i = 0; i < edgeCount; i++) {
    const from = `channel-${Math.floor(Math.random() * nodeCount)}`
    const to = `channel-${Math.floor(Math.random() * nodeCount)}`
    if (from !== to && !graph.hasEdge(from, to)) {
      graph.addEdge(from, to, { size: 1, color: "#cbd5e1" })
    }
  }

  return graph
}

import { SigmaContainer, useLoadGraph } from "@react-sigma/core"
import "@react-sigma/core/lib/style.css"
import { useEffect, useRef, useState } from "react"
import { buildMockChannelGraph } from "@/modules/telegram/graph/mockGraph"

/**
 * Phase 1 Sigma.js performance validation harness (docs/timelines/TELEGRAM_TIMELINE.md).
 * Not part of the production module — a throwaway measurement tool, kept as a Storybook
 * story so it's re-runnable if hardware or library versions change. Renders `nodeCount`
 * mock nodes and reports live FPS via a rolling requestAnimationFrame counter, visible
 * on-screen so it can be read via a screenshot or scraped via the DOM.
 */
function GraphLoader({ nodeCount, avgDegree }: { nodeCount: number; avgDegree: number }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    loadGraph(buildMockChannelGraph(nodeCount, avgDegree))
  }, [loadGraph, nodeCount, avgDegree])
  return null
}

function FpsCounter() {
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const lastTime = useRef(0)

  useEffect(() => {
    lastTime.current = performance.now()
    let raf: number
    function tick() {
      frames.current += 1
      const now = performance.now()
      const elapsed = now - lastTime.current
      if (elapsed >= 1000) {
        setFps(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        lastTime.current = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      data-testid="fps-counter"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 10,
        background: "white",
        padding: "4px 8px",
        fontFamily: "monospace",
        fontSize: 14,
      }}
    >
      FPS: {fps}
    </div>
  )
}

export function SigmaPerfProbe({
  nodeCount,
  renderLabels = true,
  avgDegree = 4,
}: {
  nodeCount: number
  renderLabels?: boolean
  avgDegree?: number
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "600px" }}>
      <FpsCounter />
      <SigmaContainer style={{ width: "100%", height: "100%" }} settings={{ renderLabels }}>
        <GraphLoader nodeCount={nodeCount} avgDegree={avgDegree} />
      </SigmaContainer>
    </div>
  )
}

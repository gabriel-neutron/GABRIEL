import { useCallback } from "react"
import { SigmaGraphCanvas } from "@/components/shared/SigmaGraphCanvas"
import { edgeTypeLabel } from "@/core/relationship/edgeForm"
import { selectEntity } from "@/core/map/selection"
import { useEntityGraph, type EntityGraphState } from "@/modules/orbat/hooks/useEntityGraph"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"

/**
 * The project's entities and their recorded relationships, drawn at once.
 *
 * The PRD's complaint was "I can catalogue the nodes of the backbone; I cannot record the
 * backbone". The relationship editor made a typed edge authorable; nothing yet made an
 * authored one visible as a *structure* — a tree view shows one hierarchy and the
 * inspector shows one entity's edges, and twenty financial and industrial edges spread
 * across 1,027 entities are invisible in both.
 *
 * Filtering is by edge, never by node: the hierarchy that positions everything is computed
 * over the whole project, so deselecting a type removes chords from a picture that
 * otherwise holds still. Comparing "with `supplies`" against "without" is meant to be a
 * comparison of two states of one graph, not of two different graphs.
 */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-full border px-2 py-0.5 text-[11px] transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent")
      }
    >
      {label}
    </button>
  )
}

function EntityGraphControls({ graph }: { graph: EntityGraphState }) {
  return (
    // Block wrapper around the wrapping flex row, not one element doing both. As a flex
    // item in the column below, a wrap container resolved its height from the width it
    // had before the detail panel opened and kept it: with thirteen type chips the row
    // wrapped to three lines inside a box sized for two, and the third — "Hide
    // unconnected" and "Reset" — laid out underneath the Sigma canvas, which swallowed
    // every click on it. `z-10` is the second half: the canvas is absolutely positioned,
    // so anything that ever does overlap it must still be the thing that gets the click.
    <div className="relative z-10 shrink-0 border-b">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Tier</span>
        {graph.typesByTier.map(({ tier }) => (
          <FilterChip
            key={tier}
            label={tier}
            active={graph.selectedTiers.includes(tier)}
            onClick={() => graph.toggleTier(tier)}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="h-4" />

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground">Type</span>
        {graph.typesByTier.flatMap(({ types }) => types).map((type) => (
          <FilterChip
            key={type}
            label={edgeTypeLabel(type)}
            active={graph.selectedTypes.includes(type)}
            onClick={() => graph.toggleType(type)}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="h-4" />

      <FilterChip
        label="Hide unconnected"
        active={graph.hideIsolated}
        onClick={() => graph.setHideIsolated(!graph.hideIsolated)}
      />

      <Button type="button" variant="ghost" size="xs" onClick={graph.reset}>
        Reset
      </Button>

      <span className="ml-auto text-muted-foreground">
        {graph.drawnCount} of {graph.totalCount} entities, {graph.edgeCount} edges
      </span>
    </div>
    </div>
  )
}

export function EntityGraphView(): React.ReactElement {
  const graph = useEntityGraph()

  // Selecting from the graph opens the same inspector the map and the tree open, so the
  // relationship editor is one click from a node — which is the loop this view exists to
  // close: see the gap, author the edge, see it drawn.
  const handleNodeClick = useCallback((id: string) => {
    selectEntity(id)
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <EntityGraphControls graph={graph} />
      {graph.graph.nodes.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          {graph.totalCount === 0
            ? "No entities in this project yet."
            : "Every entity is filtered out. Turn off “Hide unconnected”, or select more edge types."}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <SigmaGraphCanvas
            data={graph.graph}
            renderEdgeLabels={graph.edgeCount <= 60}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}
    </div>
  )
}

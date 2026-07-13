import { Button } from "@/ui/button"
import { useOsmQueryMenuStore } from "@/modules/osm/store/useOsmQueryMenuStore"

/**
 * Trigger half of the OSM query UI (ADR 0007). Lives in the header "..." dropdown
 * via `osmModule.headerContribution`, so it unmounts when that dropdown closes —
 * which is why it owns no Dialog. It only flips `useOsmQueryMenuStore.open`; the
 * always-mounted `OsmQueryDialog` (an `overlays` contribution) reacts to that,
 * matching how the command palette's `osm.query` command opens the same dialog.
 */
export function OsmQueryTrigger() {
  const setOpen = useOsmQueryMenuStore((s) => s.setOpen)
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setOpen(true)}
      title="Query OpenStreetMap and add as layer"
    >
      OpenStreetMap
    </Button>
  )
}

import { TreeView } from "@/modules/orbat/ui/TreeView"
import { EntityGraphView } from "@/modules/orbat/ui/EntityGraphView"
import { EntityInspector } from "@/modules/orbat/ui/EntityInspector"
import { HierarchyPanel } from "@/modules/orbat/ui/HierarchyPanel"
import { ReviewQueue } from "@/modules/orbat/ui/ReviewQueue"
import { SymbolsLayer } from "@/modules/orbat/ui/SymbolsLayer"
import { NonUnitEntitiesLayer } from "@/modules/orbat/ui/NonUnitEntitiesLayer"
import { NetworkLinksLayer } from "@/modules/orbat/ui/NetworkLinksLayer"
import { ENTITY_KINDS } from "@/core/entity/entity"
import { useMapPrefsStore } from "@/store/useMapPrefsStore"
import { useViewStore } from "@/shell/useViewStore"
import type { ModuleManifest } from "@/types/module.types"

/** orbat's shell contribution (ADR 0007) — every Entity kind, whatever its Profile. */
export const orbatModule: ModuleManifest = {
  views: [
    { id: "tree", label: "Hierarchy", content: <TreeView /> },
    { id: "graph", label: "Network", content: <EntityGraphView />, hideSidebar: true },
  ],

  // Every kind, built from ENTITY_KINDS rather than listed. A kind absent from this map
  // is a kind whose selection opens an empty detail panel — which is where the three bare
  // profiles sat, and with them the only route to the relationship editor.
  detailRenderer: Object.fromEntries(
    ENTITY_KINDS.map((kind) => [kind, (id: string) => <EntityInspector key={id} />]),
  ),

  leftPanels: [
    { id: "hierarchy", label: "Army", content: <HierarchyPanel /> },
    { id: "review", label: "Review", content: <ReviewQueue /> },
  ],

  mapLayers: [
    <SymbolsLayer key="symbols" />,
    <NonUnitEntitiesLayer key="non-unit-entities" />,
    <NetworkLinksLayer key="network-links" />,
  ],

  commands: [
    {
      id: "orbat.toggle-network-links",
      label: "Toggle network links",
      run: () => useMapPrefsStore.getState().setShowNetworks(!useMapPrefsStore.getState().showNetworks),
    },
    {
      id: "orbat.open-hierarchy",
      label: "Open Hierarchy view",
      run: () => useViewStore.getState().setActiveViewId("tree"),
    },
    {
      id: "orbat.open-network",
      label: "Open Network view",
      run: () => useViewStore.getState().setActiveViewId("graph"),
    },
  ],
}

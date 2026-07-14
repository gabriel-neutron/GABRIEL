import { TreeView } from "@/modules/orbat/ui/TreeView"
import { EntityInspector } from "@/modules/orbat/ui/EntityInspector"
import { HierarchyPanel } from "@/modules/orbat/ui/HierarchyPanel"
import { ReviewQueue } from "@/modules/orbat/ui/ReviewQueue"
import { SymbolsLayer } from "@/modules/orbat/ui/SymbolsLayer"
import { OrganisationsLayer } from "@/modules/orbat/ui/OrganisationsLayer"
import { NetworkLinksLayer } from "@/modules/orbat/ui/NetworkLinksLayer"
import { useMapPrefsStore } from "@/store/useMapPrefsStore"
import { useViewStore } from "@/shell/useViewStore"
import type { ModuleManifest } from "@/types/module.types"

/** orbat's shell contribution (ADR 0007) — military units + corporate entities. */
export const orbatModule: ModuleManifest = {
  views: [{ id: "tree", label: "Hierarchy", content: <TreeView /> }],

  detailRenderer: {
    unit: (id) => <EntityInspector key={id} />,
    corporate: (id) => <EntityInspector key={id} />,
  },

  leftPanels: [
    { id: "hierarchy", label: "Army", content: <HierarchyPanel /> },
    { id: "review", label: "Review", content: <ReviewQueue /> },
  ],

  mapLayers: [
    <SymbolsLayer key="symbols" />,
    <OrganisationsLayer key="organisations" />,
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
  ],
}

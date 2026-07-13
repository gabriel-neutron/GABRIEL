import { OsmQueryMenu } from "@/modules/osm/ui/OsmQueryMenu"
import { OsmObjectInspectorConnected } from "@/modules/osm/ui/OsmObjectInspectorConnected"
import { useOsmQueryMenuStore } from "@/modules/osm/store/useOsmQueryMenuStore"
import type { ModuleManifest } from "@/types/module.types"

/** osm's shell contribution (ADR 0007) — Overpass/Nominatim query results as a layer. */
export const osmModule: ModuleManifest = {
  detailRenderer: {
    osm: () => <OsmObjectInspectorConnected />,
  },

  headerContribution: <OsmQueryMenu />,

  commands: [
    {
      id: "osm.query",
      label: "Query OpenStreetMap…",
      when: (ctx) => !ctx.readOnly,
      run: () => useOsmQueryMenuStore.getState().setOpen(true),
    },
  ],
}

import { OsmQueryTrigger } from "@/modules/osm/ui/OsmQueryTrigger"
import { OsmQueryDialog } from "@/modules/osm/ui/OsmQueryDialog"
import { OsmObjectInspectorConnected } from "@/modules/osm/ui/OsmObjectInspectorConnected"
import { useOsmQueryMenuStore } from "@/modules/osm/store/useOsmQueryMenuStore"
import type { ModuleManifest } from "@/types/module.types"

/** osm's shell contribution (ADR 0007) — Overpass/Nominatim query results as a layer. */
export const osmModule: ModuleManifest = {
  detailRenderer: {
    osm: () => <OsmObjectInspectorConnected />,
  },

  // Trigger lives in the header dropdown (unmounts when it closes); the Dialog is an
  // always-mounted overlay so the `osm.query` command can open it too (ADR 0007).
  headerContribution: <OsmQueryTrigger />,

  overlays: [<OsmQueryDialog key="osm-query-dialog" />],

  commands: [
    {
      id: "osm.query",
      label: "Query OpenStreetMap…",
      when: (ctx) => !ctx.readOnly,
      run: () => useOsmQueryMenuStore.getState().setOpen(true),
    },
  ],
}

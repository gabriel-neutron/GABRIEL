import type { Meta, StoryObj } from "@storybook/react-vite"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { useProjectStore } from "@/store/useProjectStore"
import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"

const layers: Layer[] = [
  { id: "layer-custom-1", name: "Task Force Alpha", visible: true, kind: "custom" },
  { id: "layer-custom-2", name: "Support Elements", visible: true, kind: "custom" },
  {
    id: "layer-osm-1",
    name: "OSM Military Areas",
    visible: true,
    kind: "osm",
    osmData: { type: "FeatureCollection", features: [] },
  },
]

const entities: MapEntity[] = [
  {
    kind: "unit",
    id: "entity-hq",
    name: "HQ 1st Brigade",
    layerId: "layer-custom-1",
    parentId: null,
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    kind: "unit",
    id: "entity-a",
    name: "A Company",
    layerId: "layer-custom-1",
    parentId: "entity-hq",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    kind: "unit",
    id: "entity-b",
    name: "B Company",
    layerId: "layer-custom-1",
    parentId: "entity-hq",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    kind: "unit",
    id: "entity-log",
    name: "Logistics Detachment",
    layerId: "layer-custom-2",
    parentId: null,
    affiliation: "Friend",
    domain: "Ground",
  },
]

const geometries: DrawnGeometry[] = [
  { id: "geom-hq", type: "point", layerId: "layer-custom-1", entityId: "entity-hq", lat: 48.8566, lng: 2.3522 },
  { id: "geom-a", type: "point", layerId: "layer-custom-1", entityId: "entity-a", lat: 48.859, lng: 2.36 },
  { id: "geom-b", type: "point", layerId: "layer-custom-1", entityId: "entity-b", lat: 48.852, lng: 2.345 },
]

const meta = {
  title: "Shared/LayersPanel",
  component: LayersPanel,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers,
        entities,
        organisations: [],
        drawnGeometries: geometries,
        selectedEntityId: "entity-hq",
        selectedOrganisationId: null,
        sourceCache: new Map(),
      })

      return (
        <div className="h-[560px] w-[360px] border bg-background p-0">
          <Story />
        </div>
      )
    },
  ],
} satisfies Meta<typeof LayersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
}

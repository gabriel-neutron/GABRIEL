import type { Meta, StoryObj } from "@storybook/react-vite"
import { EntityInspector } from "./EntityInspector"
import { useProjectStore } from "@/store/useProjectStore"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"

const layer: Layer = {
  id: "layer-1",
  name: "Operations",
  visible: true,
  kind: "custom",
}

const entity: MapEntity = {
  id: "entity-1",
  name: "1st Infantry Company",
  layerId: layer.id,
  parentId: null,
  type: "infantry",
  affiliation: "Friend",
  domain: "Ground",
  notes: "Storybook sample entity",
}

const geometries: DrawnGeometry[] = [
  { id: "geom-1", type: "point", entityId: entity.id, layerId: layer.id, lat: 48.8566, lng: 2.3522 },
]

const meta = {
  title: "Inspector/EntityInspector",
  component: EntityInspector,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers: [layer],
        entities: [entity],
        organisations: [],
        drawnGeometries: geometries,
        selectedEntityId: entity.id,
        selectedOrganisationId: null,
        sourceCache: new Map(),
      })
      return <Story />
    },
  ],
  args: {
    readOnly: false,
    enrichedOverlay: {},
  },
} satisfies Meta<typeof EntityInspector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoSelection: Story = {
  decorators: [
    (Story) => {
      useProjectStore.getState().setSelectedEntityId(null)
      return <Story />
    },
  ],
}

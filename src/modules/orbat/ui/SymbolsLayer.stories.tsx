import type { Meta, StoryObj } from "@storybook/react-vite"
import { MapContainer, TileLayer } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { SymbolsLayer } from "./SymbolsLayer"
import { useProjectStore } from "@/store/useProjectStore"
import { asLatLng } from "@/core/coordinates"
import type { Layer, MapEntity } from "@/types/domain.types"

const layer: Layer = {
  id: "layer-1",
  name: "Operations",
  visible: true,
  kind: "custom",
}

const entity: MapEntity = {
  kind: "unit",
  id: "entity-1",
  name: "1st Infantry Company",
  layerId: layer.id,
  parentId: null,
  type: "infantry",
  affiliation: "Friend",
  domain: "Ground",
}

const meta = {
  title: "Map/SymbolsLayer",
  component: SymbolsLayer,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers: [layer],
        entities: [entity],
        drawnGeometries: [],
        selectedEntityId: entity.id,
      })
      return <Story />
    },
  ],
  args: {
    positionMap: new Map([[entity.id, asLatLng(48.8566, 2.3522)]]),
    visibleLayerIds: new Set([layer.id]),
    hiddenEntityIds: new Set<string>(),
    onSelectEntity: () => {},
    mapBounds: null,
  },
  render: (args) => (
    <div className="h-[420px] w-full">
      <MapContainer center={[48.8566, 2.3522]} zoom={12} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SymbolsLayer {...args} />
      </MapContainer>
    </div>
  ),
} satisfies Meta<typeof SymbolsLayer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

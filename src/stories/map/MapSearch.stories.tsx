import type { Meta, StoryObj } from "@storybook/react"
import { MapContainer, TileLayer } from "react-leaflet"
import { MapSearch } from "@/components/map/MapSearch"

const mapDecorator = (Story: React.ComponentType) => (
  <div style={{ height: "400px" }}>
    <MapContainer
      center={[48.85, 2.35]}
      zoom={10}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Story />
    </MapContainer>
  </div>
)

const meta: Meta<typeof MapSearch> = {
  component: MapSearch,
  title: "Map/MapSearch",
  decorators: [mapDecorator],
}
export default meta

type Story = StoryObj<typeof MapSearch>

export const Default: Story = {}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MapContainer, TileLayer } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { MapToolSelector } from "@/components/map/MapToolSelector"

const meta = {
  title: "Map/MapToolSelector",
  component: MapToolSelector,
  args: {
    mapTool: "pan",
    onMapToolChange: () => undefined,
  },
  render: (args) => (
    <div className="h-[420px] w-full">
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={12}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapToolSelector {...args} />
      </MapContainer>
    </div>
  ),
} satisfies Meta<typeof MapToolSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

import type { Meta, StoryObj } from "@storybook/react-vite"
import "leaflet/dist/leaflet.css"
import { MapView } from "./MapView"

const meta = {
  title: "Map/MapView",
  component: MapView,
  args: {
    readOnly: true,
    defaultLayerId: "layer-1",
    onCreateNewEntity: () => undefined,
    onLinkGeometryToEntity: () => undefined,
  },
  render: (args) => (
    <div className="h-[520px] w-full">
      <MapView {...args} />
    </div>
  ),
} satisfies Meta<typeof MapView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

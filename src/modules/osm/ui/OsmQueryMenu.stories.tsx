import type { Meta, StoryObj } from "@storybook/react-vite"
import { OsmQueryMenu } from "./OsmQueryMenu"

const meta = {
  title: "Shared/OsmQueryMenu",
  component: OsmQueryMenu,
  args: {
    layers: [],
    onAddLayer: () => undefined,
  },
  render: (args) => (
    <div className="p-4">
      <OsmQueryMenu {...args} />
    </div>
  ),
} satisfies Meta<typeof OsmQueryMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}


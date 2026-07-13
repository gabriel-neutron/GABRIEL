import type { Meta, StoryObj } from "@storybook/react-vite"
import { OsmQueryMenu } from "./OsmQueryMenu"
import { useProjectStore } from "@/store/useProjectStore"

const meta = {
  title: "Shared/OsmQueryMenu",
  component: OsmQueryMenu,
  decorators: [
    (Story) => {
      useProjectStore.getState().resetProject()
      return <Story />
    },
  ],
  render: () => (
    <div className="p-4">
      <OsmQueryMenu />
    </div>
  ),
} satisfies Meta<typeof OsmQueryMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

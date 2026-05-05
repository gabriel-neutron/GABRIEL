import type { Meta, StoryObj } from "@storybook/react-vite"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"

const meta = {
  title: "Shared/ShowNetworksToggle",
  component: ShowNetworksToggle,
  render: () => {
    return (
      <div className="p-4">
        <ShowNetworksToggle />
      </div>
    )
  },
} satisfies Meta<typeof ShowNetworksToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}


import type { Meta, StoryObj } from "@storybook/react-vite"
import { BaseMapSwitcher } from "@/components/shared/BaseMapSwitcher"

const meta = {
  title: "Shared/BaseMapSwitcher",
  component: BaseMapSwitcher,
} satisfies Meta<typeof BaseMapSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

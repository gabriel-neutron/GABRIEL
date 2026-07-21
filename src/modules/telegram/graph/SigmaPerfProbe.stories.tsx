import type { Meta, StoryObj } from "@storybook/react-vite"
import { SigmaPerfProbe } from "@/modules/telegram/graph/SigmaPerfProbe"

const meta: Meta<typeof SigmaPerfProbe> = {
  title: "telegram/SigmaPerfProbe (Phase 1 validation)",
  component: SigmaPerfProbe,
}
export default meta

type Story = StoryObj<typeof SigmaPerfProbe>

export const Nodes1000: Story = { args: { nodeCount: 1000 } }
export const Nodes5000: Story = { args: { nodeCount: 5000 } }
export const Nodes10000: Story = { args: { nodeCount: 10000 } }
export const Nodes5000NoLabels: Story = { args: { nodeCount: 5000, renderLabels: false } }
export const Nodes10000NoLabels: Story = { args: { nodeCount: 10000, renderLabels: false } }
export const Nodes5000SparseNoLabels: Story = {
  args: { nodeCount: 5000, renderLabels: false, avgDegree: 2 },
}

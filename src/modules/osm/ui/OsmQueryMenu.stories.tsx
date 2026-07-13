import type { Meta, StoryObj } from "@storybook/react-vite"
import { OsmQueryTrigger } from "./OsmQueryTrigger"
import { OsmQueryDialog } from "./OsmQueryDialog"
import { useProjectStore } from "@/store/useProjectStore"

/**
 * The OSM query UI is split (ADR 0007): `OsmQueryTrigger` lives in the header
 * dropdown, `OsmQueryDialog` is an always-mounted overlay. Both share
 * `useOsmQueryMenuStore`, so rendering them together here mirrors the app.
 */
const meta = {
  title: "Shared/OsmQueryMenu",
  component: OsmQueryTrigger,
  decorators: [
    (Story) => {
      useProjectStore.getState().resetProject()
      return <Story />
    },
  ],
  render: () => (
    <div className="p-4">
      <OsmQueryTrigger />
      <OsmQueryDialog />
    </div>
  ),
} satisfies Meta<typeof OsmQueryTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { OsmObjectInspector } from "@/components/inspector/OsmObjectInspector"

const meta = {
  title: "Inspector/OsmObjectInspector",
  component: OsmObjectInspector,
  args: {
    type: "relation",
    id: 123456,
    cachedFeature: {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [2.3522, 48.8566],
      },
      properties: {
        tags: {
          name: "Sample Base",
          military: "base",
        },
        version: 1,
        changeset: 999,
        timestamp: "2026-05-01T12:00:00.000Z",
        user: "test-user",
      },
    },
  },
} satisfies Meta<typeof OsmObjectInspector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

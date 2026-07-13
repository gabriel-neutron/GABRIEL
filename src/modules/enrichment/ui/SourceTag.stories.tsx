import type { Meta, StoryObj } from "@storybook/react-vite"
import { SourceTag } from "./SourceTag"

const meta = {
  title: "Enrichment/SourceTag",
  component: SourceTag,
  args: {
    source: {
      url: "https://example.com/report",
      title: "Example report",
      snippet: "Reference snippet",
      domainType: "official",
      publishedAt: "2026-01-10T00:00:00.000Z",
    },
  },
} satisfies Meta<typeof SourceTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

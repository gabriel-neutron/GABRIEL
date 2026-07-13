import type { Meta, StoryObj } from "@storybook/react-vite"
import { ProposalCard } from "./ProposalCard"

const meta = {
  title: "Enrichment/ProposalCard",
  component: ProposalCard,
  args: {
    decision: "pending",
    proposal: {
      field: "notes",
      currentValue: "Current value",
      proposedValue: "Proposed value",
      reasoning: "Evidence-based update suggested from sources.",
      citations: [
        {
          url: "https://example.com/report",
          title: "Example report",
          snippet: "Reference snippet",
          domainType: "official",
          publishedAt: "2026-01-10T00:00:00.000Z",
        },
      ],
    },
    onAccept: () => undefined,
    onReject: () => undefined,
  },
} satisfies Meta<typeof ProposalCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

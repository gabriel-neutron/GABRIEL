import type { Meta, StoryObj } from "@storybook/react-vite"
import { DuplicateMatchesSection } from "./DuplicateMatchesSection"

const meta = {
  title: "Orbat/DuplicateMatchesSection",
  component: DuplicateMatchesSection,
  args: {
    onMerge: (id: string) => console.log("merge", id),
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] rounded-md border bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DuplicateMatchesSection>

export default meta
type Story = StoryObj<typeof meta>

export const WithCandidates: Story = {
  args: {
    candidates: [
      { id: "a", name: "Вагнер", score: 1, reason: "exact-normalized" },
      { id: "b", name: "1st Guard Army", score: 0.93, reason: "similar-name" },
    ],
  },
}

export const Empty: Story = {
  args: { candidates: [] },
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { FilterableSelect } from "@/components/shared/FilterableSelect"

const meta = {
  title: "shared/FilterableSelect",
  component: FilterableSelect,
  args: {
    placeholder: "No parent",
    value: "__none__",
    options: [
      { id: "u-1", name: "1st Division", echelon: "Division" },
      { id: "u-2", name: "2nd Brigade", echelon: "Brigade" },
      { id: "u-3", name: "Alpha Company", echelon: "Company/battery/troop" },
      { id: "u-4", name: "Recon Team", echelon: "Team/Crew" },
      { id: "u-5", name: "HQ Reserve" },
    ],
  },
  render: (args) => <FilterableSelect {...args} onValueChange={() => {}} />,
} satisfies Meta<typeof FilterableSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

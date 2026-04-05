import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { FilterableSelect, type ParentOption } from "@/components/shared/FilterableSelect"

const meta: Meta<typeof FilterableSelect> = {
  component: FilterableSelect,
  title: "Tree/FilterableSelect",
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full border bg-background p-4">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof FilterableSelect>

const OPTIONS: ParentOption[] = [
  { id: "1", name: "41st Guards Combined Arms Army", echelon: "Army" },
  { id: "2", name: "3rd Motorized Rifle Division", echelon: "Division" },
  { id: "3", name: "448th Missile Brigade", echelon: "Brigade" },
  { id: "4", name: "419th Guards Motor Rifle Training Regiment", echelon: "Regiment/group" },
  { id: "5", name: "74th Separate Repair and Restoration Battalion", echelon: "Battalion/squadron" },
  { id: "6", name: "81st Repair and Restoration Battalion", echelon: "Battalion/squadron" },
  { id: "7", name: "7th Separate Reconnaissance Battalion", echelon: "Battalion/squadron" },
  { id: "8", name: "752nd Motorized Rifle Regiment", echelon: "Regiment/group" },
  { id: "9", name: "Region Command Example", echelon: "Region/Theater" },
]

function StatefulStory() {
  const [value, setValue] = useState<string>("__none__")
  return (
    <div className="space-y-2">
      <FilterableSelect
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
        placeholder="No parent"
        className="w-full"
      />
      <div className="text-xs text-muted-foreground">
        Value: <span className="font-mono">{value}</span>
      </div>
    </div>
  )
}

export const Default: Story = {
  render: () => <StatefulStory />,
}


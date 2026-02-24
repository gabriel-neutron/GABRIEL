import type { Meta, StoryObj } from "@storybook/react"
import { GeometryActionMenu } from "@/components/map/GeometryActionMenu"
import type { MapEntity } from "@/types/domain.types"

const mockEntities: MapEntity[] = [
  { id: "e1", name: "1st Battalion", layerId: "l1", parentId: null },
  { id: "e2", name: "2nd Company", layerId: "l1", parentId: "e1" },
  { id: "e3", name: "HQ Unit", layerId: "l1", parentId: "e1" },
]

const noop = () => {}

const meta: Meta<typeof GeometryActionMenu> = {
  component: GeometryActionMenu,
  title: "Map/GeometryActionMenu",
  argTypes: {
    onCreateNew: { action: "createNew" },
    onLinkToExisting: { action: "linkToExisting" },
    onCancel: { action: "cancel" },
  },
}
export default meta

type Story = StoryObj<typeof GeometryActionMenu>

export const Default: Story = {
  args: {
    entities: mockEntities,
    onCreateNew: noop,
    onLinkToExisting: noop,
    onCancel: noop,
  },
}

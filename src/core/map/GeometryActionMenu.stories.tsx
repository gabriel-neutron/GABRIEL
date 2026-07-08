import type { Meta, StoryObj } from "@storybook/react-vite"
import { GeometryActionMenu } from "./GeometryActionMenu"
import type { MapEntity } from "@/types/domain.types"

const entities: MapEntity[] = [
  {
    kind: "unit",
    id: "entity-1",
    name: "1st Brigade",
    type: "Land Unit",
    layerId: "layer-1",
    parentId: null,
    notes: "",
    affiliation: "Friend",
    domain: "Ground",
    natoSymbolCode: "",
    echelon: "Brigade",
    militaryUnitId: "",
    osmRelationId: undefined,
  },
]

const meta: Meta<typeof GeometryActionMenu> = {
  title: "Map/GeometryActionMenu",
  component: GeometryActionMenu,
  parameters: {
    layout: "centered",
  },
  args: {
    entities,
    onCreateNew: () => {},
    onLinkToExisting: () => {},
    onCancel: () => {},
  },
}

export default meta

type Story = StoryObj<typeof GeometryActionMenu>

export const Default: Story = {}

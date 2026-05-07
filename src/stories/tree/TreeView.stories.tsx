import type { Meta, StoryObj } from "@storybook/react-vite"
import { TreeView } from "@/components/tree/TreeView"
import { useProjectStore } from "@/store/useProjectStore"
import type { Layer, MapEntity } from "@/types/domain.types"

const layers: Layer[] = [{ id: "layer-tree", name: "Tree Layer", visible: true, kind: "custom" }]

const entities: MapEntity[] = [
  {
    id: "hq",
    name: "HQ",
    layerId: "layer-tree",
    parentId: null,
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "alpha",
    name: "Alpha Company",
    layerId: "layer-tree",
    parentId: "hq",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "bravo",
    name: "Bravo Company",
    layerId: "layer-tree",
    parentId: "hq",
    affiliation: "Friend",
    domain: "Ground",
  },
]

const meta = {
  title: "Tree/TreeView",
  component: TreeView,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers,
        entities,
        organisations: [],
        drawnGeometries: [],
        selectedEntityId: "alpha",
        selectedOrganisationId: null,
        sourceCache: new Map(),
      })

      return (
        <div className="h-[560px] w-full rounded-md border bg-background">
          <Story />
        </div>
      )
    },
  ],
} satisfies Meta<typeof TreeView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

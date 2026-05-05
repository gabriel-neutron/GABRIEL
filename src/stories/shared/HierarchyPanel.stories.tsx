import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { HierarchyPanel } from "@/components/shared/HierarchyPanel"
import { useProjectStore } from "@/store/useProjectStore"
import type { MapEntity } from "@/types/domain.types"

const entities: MapEntity[] = [
  {
    id: "entity-hq",
    name: "HQ 1st Brigade",
    layerId: "layer-custom-1",
    parentId: null,
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l1",
    name: "1st Battalion",
    layerId: "layer-custom-1",
    parentId: "entity-hq",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l2",
    name: "A Company",
    layerId: "layer-custom-1",
    parentId: "entity-l1",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l3",
    name: "1st Platoon",
    layerId: "layer-custom-1",
    parentId: "entity-l2",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l4",
    name: "1st Squad",
    layerId: "layer-custom-1",
    parentId: "entity-l3",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l5",
    name: "Fire Team Alpha",
    layerId: "layer-custom-1",
    parentId: "entity-l4",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-l6",
    name: "Marksman Cell",
    layerId: "layer-custom-1",
    parentId: "entity-l5",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-b",
    name: "B Company",
    layerId: "layer-custom-1",
    parentId: "entity-l1",
    affiliation: "Friend",
    domain: "Ground",
  },
  {
    id: "entity-log",
    name: "Logistics Detachment",
    layerId: "layer-custom-1",
    parentId: null,
    affiliation: "Friend",
    domain: "Ground",
  },
]

function StoryHarness() {
  const [hiddenEntityIds, setHiddenEntityIds] = useState<Set<string>>(new Set())

  function handleToggleEntityVisible(entityId: string, visible: boolean) {
    setHiddenEntityIds((prev) => {
      const next = new Set(prev)
      if (visible) {
        next.delete(entityId)
      } else {
        next.add(entityId)
      }
      return next
    })
  }

  return (
    <HierarchyPanel
      hiddenEntityIds={hiddenEntityIds}
      onToggleEntityVisible={handleToggleEntityVisible}
    />
  )
}

const meta = {
  title: "Shared/HierarchyPanel",
  component: HierarchyPanel,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers: [],
        entities,
        drawnGeometries: [],
        selectedEntityId: "entity-hq",
        sourceCache: new Map(),
      })

      return (
        <div className="h-[560px] w-[360px] border bg-background p-0">
          <Story />
        </div>
      )
    },
  ],
} satisfies Meta<typeof HierarchyPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    hiddenEntityIds: new Set(),
    onToggleEntityVisible: () => {},
  },
  render: () => <StoryHarness />,
}

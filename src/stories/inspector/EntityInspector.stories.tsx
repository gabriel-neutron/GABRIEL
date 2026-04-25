import type { Meta, StoryObj } from "@storybook/react"
import type { Layer, MapEntity } from "@/types/domain.types"
import { EntityInspector } from "../../components/inspector/EntityInspector"
import { useProjectStore } from "../../store/useProjectStore"
import { useEffect } from "react"

const meta: Meta<typeof EntityInspector> = {
  component: EntityInspector,
  title: "Inspector/EntityInspector",
  decorators: [
    (Story, context) => {
      const StoreInit = () => {
        useEffect(() => {
          useProjectStore.setState({
            entities: defaultEntities,
            layers: defaultLayers,
            drawnGeometries: defaultGeometries,
            selectedEntityId: "entity-1",
          })
        }, [])
        return null
      }
      return (
        <div className="h-full w-[320px] border">
          <StoreInit />
          <Story {...context} />
        </div>
      )
    },
  ],
}
export default meta

const defaultLayers: Layer[] = [
  { id: "layer-1", name: "Units", visible: true, kind: "custom" },
  { id: "Division", name: "Division", visible: true, kind: "echelon" },
]

const defaultEntities: MapEntity[] = [
  {
    id: "entity-1",
    name: "5th Motor Rifle Brigade",
    layerId: "layer-1",
    parentId: null,
    type: "infantry",
    echelon: "Brigade",
    affiliation: "Friend",
    domain: "Ground",
    militaryUnitId: "MU-001",
    notes: "Deployed in sector Alpha.",
    sources: "https://example.com/unit-briefing\nField report #23-7",
    osmRelationId: null,
  },
]

const defaultGeometries = [
  {
    id: "geom-1",
    layerId: "layer-1",
    entityId: "entity-1",
    type: "point" as const,
    lat: 48.8566,
    lng: 2.3522,
  },
]

type Story = StoryObj<typeof EntityInspector>

export const Prefilled: Story = {
  args: {
    readOnly: false,
  },
}

export const PrefilledReadOnly: Story = {
  args: {
    readOnly: true,
  },
}

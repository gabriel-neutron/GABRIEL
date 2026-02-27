import type { Meta, StoryObj } from "@storybook/react"
import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"
import { EntityInspector } from "../../components/inspector/EntityInspector"

const meta: Meta<typeof EntityInspector> = {
  component: EntityInspector,
  title: "Inspector/EntityInspector",
  decorators: [
    (Story) => (
      <div className="h-full w-[320px] border">
        <Story />
      </div>
    ),
  ],
}
export default meta

const noop = () => {}

const defaultLayers: Layer[] = [
  { id: "layer-1", name: "Units", visible: true, expanded: true, kind: "custom" },
  { id: "Division", name: "Division", visible: true, expanded: true, kind: "echelon" },
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

const defaultGeometries: DrawnGeometry[] = [
  {
    id: "geom-1",
    layerId: "layer-1",
    entityId: "entity-1",
    type: "point",
    lat: 48.8566,
    lng: 2.3522,
  },
]

type Story = StoryObj<typeof EntityInspector>


export const Prefilled: Story = {
  args: {
    readOnly: false,
    selectedEntityId: "entity-1",
    entities: defaultEntities,
    layers: defaultLayers,
    drawnGeometries: defaultGeometries,
    onUpdateEntity: noop,
    onDeleteEntity: noop,
    onDeleteGeometry: noop,
  },
}

export const PrefilledReadOnly: Story = {
  args: {
    ...Prefilled.args,
    readOnly: true,
  },
}

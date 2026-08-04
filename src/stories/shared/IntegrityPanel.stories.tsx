import type { Meta, StoryObj } from "@storybook/react-vite"
import { IntegrityPanel } from "@/components/shared/IntegrityPanel"
import { useProjectStore } from "@/store/useProjectStore"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { Relationship } from "@/core/relationship/relationship"
import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"

const layers: Layer[] = [{ id: "layer-custom-1", name: "Task Force Alpha", visible: true, kind: "custom" }]

const entities: MapEntity[] = [
  { kind: "unit", id: "entity-hq", name: "HQ 1st Brigade", layerId: "layer-custom-1", parentId: null, affiliation: "Friend", domain: "Ground" },
  { kind: "unit", id: "entity-log", name: "Logistics Detachment", layerId: "layer-custom-1", parentId: null, affiliation: "Friend", domain: "Ground" },
  { kind: "unit", id: "entity-b", name: "B Company", layerId: "layer-custom-1", parentId: null, affiliation: "Friend", domain: "Ground" },
  { kind: "unit", id: "entity-b-platoon", name: "2nd Platoon, B Company", layerId: "layer-custom-1", parentId: null, affiliation: "Friend", domain: "Ground" },
]

/**
 * A real contest, not a hand-written event: `setProject` routes through `commitRelationships`,
 * which mints the `multiple-active-hierarchy` record from these edges. So the story depicts a
 * state the app actually produces — the correction the HierarchyPanel story needed in Slice 3.
 *
 * `entity-b-platoon` sits UNDER the contested company and is placed nowhere as a result, which
 * is what makes it appear in the unplaced notice alongside its parent.
 */
const relationships: Relationship[] = [
  { id: "hier:entity-b:hq", fromId: "entity-b", toId: "entity-hq", type: "subordinate_to", startDate: null, endDate: null, metadata: {} },
  { id: "hier:entity-b:log", fromId: "entity-b", toId: "entity-log", type: "subordinate_to", startDate: null, endDate: null, metadata: {} },
  { id: "hier:entity-b-platoon", fromId: "entity-b-platoon", toId: "entity-b", type: "subordinate_to", startDate: null, endDate: null, metadata: {} },
]

/** Carried in from disk, as a loaded project would: these two kinds are minted by the load
 *  path, not by an edit, and the acknowledged one shows what a read record looks like. */
const loadedEvents: IntegrityEvent[] = [
  {
    id: "ie-migrated",
    kind: "hierarchy-migrated",
    createdAt: "2026-08-01T08:30:00.000Z",
    summary: "4 stored parent columns were migrated into relationships, which are now the record of who sits under whom.",
    detail: { migrated: 4 },
    acknowledgedBy: "analyst-a",
    acknowledgedAt: "2026-08-02T11:05:00.000Z",
    acknowledgedNote: "Expected — this project predates the edge model.",
  },
  {
    id: "ie-invalid",
    kind: "invalid-entry",
    createdAt: "2026-08-03T14:12:00.000Z",
    summary: "A relationship carries an end date before its start date, so it is kept exactly as recorded and left for a person to correct.",
    detail: { code: "date-order", relationshipId: "rel-88", detail: "endDate 2021-03-01 precedes startDate 2022-06-14" },
  },
]

const geometries: DrawnGeometry[] = [
  { id: "geom-hq", type: "point", layerId: "layer-custom-1", entityId: "entity-hq", lat: 48.8566, lng: 2.3522 },
  { id: "geom-log", type: "point", layerId: "layer-custom-1", entityId: "entity-log", lat: 48.852, lng: 2.345 },
]

const meta = {
  title: "Shared/IntegrityPanel",
  component: IntegrityPanel,
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers,
        entities,
        drawnGeometries: geometries,
        claims: [],
        relationships,
        integrityEvents: loadedEvents,
        selectedEntityId: null,
      })

      return (
        <div className="h-[560px] w-[360px] border bg-background p-0">
          <Story />
        </div>
      )
    },
  ],
} satisfies Meta<typeof IntegrityPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** ViewPage's posture: the ledger is still fully readable, and nothing can be written. */
export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
}

/** The ordinary case, and deliberately not phrased as a clean bill of health. */
export const NothingRecorded: Story = {
  decorators: [
    (Story) => {
      useProjectStore.getState().setProject({
        layers,
        entities,
        drawnGeometries: geometries,
        claims: [],
        relationships: [relationships[0], relationships[2]],
        integrityEvents: [],
        selectedEntityId: null,
      })

      return (
        <div className="h-[560px] w-[360px] border bg-background p-0">
          <Story />
        </div>
      )
    },
  ],
}

import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelationshipSection } from "./RelationshipSection"
import { useProjectStore } from "@/store/useProjectStore"
import type { Relationship } from "@/core/relationship/relationship"
import type { Layer, MapEntity } from "@/types/domain.types"

/**
 * The visual half of the editor. There is no React Testing Library in this repo, so the rules
 * live in `core/relationship/` under test and the states worth looking at live here — including
 * the two the real project cannot produce, since all 1,012 of its edges are undated
 * `subordinate_to` and `corporate_parent` with no metadata on any of them.
 */

const layer: Layer = { id: "industry", name: "Industry", visible: true, kind: "organisation" }

function org(id: string, name: string): MapEntity {
  return { kind: "corporate", id, name, layerId: layer.id, parentId: null, type: "other" } as MapEntity
}

function person(id: string, name: string): MapEntity {
  return { kind: "person", id, name, layerId: layer.id, parentId: null } as MapEntity
}

const entities: MapEntity[] = [
  org("sub", "Bearing Plant No. 4"),
  org("parent", "Holding Group SA"),
  org("customer", "State Arsenal"),
  person("owner", "Beneficial owner"),
]

function edge(id: string, fromId: string, toId: string, over: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type: "supplies", startDate: null, endDate: null, metadata: {}, ...over }
}

function seed(relationships: Relationship[], selectedEntityId = "sub"): void {
  useProjectStore.getState().setProject({
    layers: [layer],
    entities,
    drawnGeometries: [],
    claims: [],
    relationships,
    integrityEvents: [],
    selectedEntityId,
  })
}

const meta = {
  title: "Inspector/RelationshipSection",
  component: RelationshipSection,
  args: { readOnly: false },
} satisfies Meta<typeof RelationshipSection>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing recorded — what an analyst sees on every entity in the project today. */
export const Empty: Story = {
  decorators: [(Story) => { seed([]); return <Story /> }],
}

/** A chain: a supplier, its corporate parent, and an owner held by a natural person. */
export const Chain: Story = {
  decorators: [
    (Story) => {
      seed([
        edge("r-1", "sub", "customer", { type: "supplies" }),
        edge("r-2", "sub", "parent", { type: "corporate_parent", metadata: { percent: 51 } }),
        edge("r-3", "customer", "sub", { type: "shipped_to", startDate: "2026-02-11" }),
      ])
      return <Story />
    },
  ],
}

/** An ended edge beside an active one — the shape "ownership transferred" takes. */
export const EndDated: Story = {
  decorators: [
    (Story) => {
      seed([
        edge("r-1", "sub", "parent", { type: "corporate_parent", endDate: "2026-03-01" }),
        edge("r-2", "sub", "owner", { type: "owned_by", startDate: "2026-03-01", metadata: { percent: 100 } }),
      ])
      return <Story />
    },
  ],
}

/** The one assessment-tier type, which the export gate excludes unless overridden. */
export const Assessment: Story = {
  decorators: [
    (Story) => {
      seed([edge("r-1", "sub", "parent", { type: "acts_for", metadata: { basis: "proxy" } })])
      return <Story />
    },
  ],
}

export const ReadOnly: Story = {
  args: { readOnly: true },
  decorators: [
    (Story) => {
      seed([edge("r-1", "sub", "customer", { type: "supplies" })])
      return <Story />
    },
  ],
}

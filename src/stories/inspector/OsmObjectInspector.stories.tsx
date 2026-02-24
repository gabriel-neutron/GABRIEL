import type { Meta, StoryObj } from "@storybook/react"
import { OsmObjectDetailsView } from "@/components/inspector/OsmObjectDetailsView"
import type { OsmObjectDetails } from "@/services/overpass.service"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const BASE: OsmObjectDetails = {
  type: "relation",
  id: 1234567,
  version: 42,
  changeset: 987654,
  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  user: "mapper_joe",
  tags: {
    name: "Grafenwöhr Training Area",
    "name:en": "Grafenwöhr Training Area",
    military: "training_area",
    landuse: "military",
    boundary: "administrative",
    operator: "US Army",
    website: "https://www.grafenwoehr.army.mil",
    wikidata: "Q315233",
    comment: "Major US Army training installation in Bavaria",
  },
}

const WAY: OsmObjectDetails = {
  type: "way",
  id: 9876543,
  version: 3,
  changeset: 111222,
  timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
  user: "roadmapper",
  tags: {
    highway: "secondary",
    name: "Truppenübungsplatz Straße",
    maxspeed: "50",
    surface: "asphalt",
  },
}

const NODE: OsmObjectDetails = {
  type: "node",
  id: 1111111,
  version: 1,
  changeset: 333444,
  timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
  user: "new_contributor",
  tags: {
    amenity: "entrance",
    name: "Gate 3",
    access: "military",
  },
}

const NO_TAGS: OsmObjectDetails = {
  type: "node",
  id: 9999999,
  version: 1,
  changeset: 0,
  timestamp: "",
  user: "",
  tags: {},
}

const NO_META: OsmObjectDetails = {
  type: "relation",
  id: 5555555,
  version: 0,
  changeset: 0,
  timestamp: "",
  user: "",
  tags: {
    name: "Mystery Boundary",
    boundary: "administrative",
  },
}

// ---------------------------------------------------------------------------

const meta: Meta<typeof OsmObjectDetailsView> = {
  title: "Inspector/OsmObjectDetailsView",
  component: OsmObjectDetailsView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-80 rounded border bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof OsmObjectDetailsView>

export const RelationFullData: Story = {
  name: "Relation — full data",
  args: { details: BASE },
}

export const Way: Story = {
  name: "Way — modified recently",
  args: { details: WAY },
}

export const Node: Story = {
  name: "Node — just now",
  args: { details: NODE },
}

export const NoTags: Story = {
  name: "No tags",
  args: { details: NO_TAGS },
}

export const NoMeta: Story = {
  name: "No metadata (version/timestamp/user absent)",
  args: { details: NO_META },
}
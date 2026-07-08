import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  FindOsmAtPointDialog,
  FindOsmAtPointDialogContent,
} from "./FindOsmAtPointDialog"
import type { OsmElementCandidate } from "@/modules/osm/hooks/useFindOsmAtPoint"

const sampleCandidates: OsmElementCandidate[] = [
  { type: "relation", id: 123456, tags: { name: "Camp Alpha", military: "base" } },
  { type: "way", id: 456789, tags: { name: "Perimeter", landuse: "military" } },
  { type: "relation", id: 987654, tags: { name: "Depot Sector", boundary: "administrative" } },
  { type: "node", id: 222333, tags: { amenity: "bunker" } },
  { type: "relation", id: 111222, tags: { name: "Training Area", military: "range" } },
  { type: "way", id: 333444, tags: { building: "yes", name: "Hangar 3" } },
]

const meta = {
  title: "Inspector/FindOsmAtPointDialog",
  component: FindOsmAtPointDialog,
  args: {
    open: true,
    lat: 48.8566,
    lng: 2.3522,
    onClose: () => undefined,
    onSelectRelation: () => undefined,
  },
} satisfies Meta<typeof FindOsmAtPointDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {}

export const Searching: StoryObj<typeof FindOsmAtPointDialogContent> = {
  render: (args) => <FindOsmAtPointDialogContent {...args} />,
  args: {
    open: true,
    onClose: () => undefined,
    loading: true,
    error: null,
    candidates: [],
    onSelectRelation: () => undefined,
  },
}

export const WithResults: StoryObj<typeof FindOsmAtPointDialogContent> = {
  render: (args) => <FindOsmAtPointDialogContent {...args} />,
  args: {
    open: true,
    onClose: () => undefined,
    loading: false,
    error: null,
    candidates: sampleCandidates,
    onSelectRelation: () => undefined,
  },
}

export const Error: StoryObj<typeof FindOsmAtPointDialogContent> = {
  render: (args) => <FindOsmAtPointDialogContent {...args} />,
  args: {
    open: true,
    onClose: () => undefined,
    loading: false,
    error: "Overpass request timed out after 25s.",
    candidates: [],
    onSelectRelation: () => undefined,
  },
}

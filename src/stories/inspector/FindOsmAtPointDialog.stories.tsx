import type { Meta, StoryObj } from "@storybook/react"
import {
  FindOsmAtPointDialogContent,
  type FindOsmAtPointDialogContentProps,
} from "../../components/inspector/FindOsmAtPointDialog"
import type { OsmElementCandidate } from "../../components/inspector/useFindOsmAtPoint"

const mockCandidates: OsmElementCandidate[] = [
  { type: "relation", id: 12345, tags: { name: "Camp de la base", landuse: "military" } },
  { type: "way", id: 67890, tags: { name: "Main road", highway: "primary" } },
  { type: "node", id: 11111, tags: { name: "HQ Building", amenity: "place" } },
  { type: "relation", id: 99999, tags: { boundary: "administrative" } },
]

const baseProps: FindOsmAtPointDialogContentProps = {
  open: true,
  onClose: () => {},
  loading: false,
  error: null,
  candidates: [],
  onSelectRelation: () => {},
}

const meta: Meta<typeof FindOsmAtPointDialogContent> = {
  component: FindOsmAtPointDialogContent,
  title: "Inspector/FindOsmAtPointDialog",
  argTypes: {
    open: { control: "boolean" },
    loading: { control: "boolean" },
    error: { control: "text" },
  },
}
export default meta

type Story = StoryObj<typeof FindOsmAtPointDialogContent>

export const Closed: Story = {
  args: { ...baseProps, open: false },
}

export const Loading: Story = {
  args: { ...baseProps, loading: true },
}

export const Error: Story = {
  args: {
    ...baseProps,
    error: "Overpass API request failed. Please try again.",
  },
}

export const Empty: Story = {
  args: baseProps,
}

export const WithCandidates: Story = {
  args: { ...baseProps, candidates: mockCandidates },
}

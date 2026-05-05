import type { Meta, StoryObj } from "@storybook/react-vite"
import { EnrichDrawer } from "@/components/enrichment/EnrichDrawer"

const meta = {
  title: "Enrichment/EnrichDrawer",
  component: EnrichDrawer,
  args: {
    open: true,
    entity: {
      id: "entity-1",
      name: "1st Infantry Brigade",
      layerId: "layer-1",
      parentId: null,
      analyzedAt: "2026-01-12T10:30:00.000Z",
    },
    context: {
      parent: {
        id: "parent-1",
        name: "Division HQ",
        echelon: "Division",
      },
      children: [
        { id: "child-1", name: "1st Battalion", echelon: "Battalion" },
        { id: "child-2", name: "2nd Battalion", echelon: "Battalion" },
      ],
    },
    prompt: "Gather current command structure and verified identifiers.",
    status: "success",
    queryTrace: ["1st Infantry Brigade command structure", "Division HQ unit records"],
    depthUsed: 2,
    unresolvedFields: ["osmRelationId"],
    unresolvedReasons: { osmRelationId: "conflict" },
    conflicts: {
      osmRelationId: [
        {
          value: 123456,
          sources: [
            {
              url: "https://example.com/source-1",
              title: "Official source",
              snippet: "Candidate relation id",
              domainType: "official",
            },
          ],
        },
      ],
    },
    notes: "Multiple relation ids found across sources.",
    proposals: [
      {
        field: "militaryUnitId",
        currentValue: null,
        proposedValue: "A1-23",
        reasoning: "Matched in two official registries.",
        sources: [
          {
            url: "https://example.com/source-2",
            title: "Registry",
            snippet: "Unit identifier",
            domainType: "official",
          },
        ],
      },
    ],
    decisions: { militaryUnitId: "pending" },
    errorMessage: null,
    closeNotice: null,
    onClose: () => undefined,
    onPromptChange: () => undefined,
    onRun: () => undefined,
    onAccept: () => undefined,
    onReject: () => undefined,
  },
} satisfies Meta<typeof EnrichDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

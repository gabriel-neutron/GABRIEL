import type { Meta, StoryObj } from "@storybook/react"
import { EnrichDrawer } from "@/components/enrichment/EnrichDrawer"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentContext, EnrichmentProposal } from "@/types/enrichment.types"

const noop = () => {}

const baseEntity: MapEntity = {
  id: "entity-42",
  name: "5th Mechanized Brigade",
  layerId: "layer-units",
  parentId: "entity-parent",
  type: "infantry",
  echelon: "Brigade",
  affiliation: "Friend",
  domain: "Ground",
  militaryUnitId: "MU-5MB",
  notes: "Operating near strategic corridors.",
  osmRelationId: 456789,
}

const baseContext: EnrichmentContext = {
  parent: {
    id: "entity-parent",
    name: "2nd Division",
    echelon: "Division",
    hq_location: "N48.8566 E2.3522",
  },
  children: [
    { id: "entity-child-1", name: "1st Battalion", echelon: "Battalion" },
    { id: "entity-child-2", name: "2nd Battalion", echelon: "Battalion" },
  ],
}

const baseProposal: EnrichmentProposal = {
  field: "notes",
  currentValue: "Operating near strategic corridors.",
  proposedValue: "Confirmed logistics hub and engineering support near east corridor.",
  reasoning:
    "Cross-validation from multiple independent sources indicates infrastructure and support roles.",
  sources: [
    {
      url: "https://example.org/briefing",
      title: "Official briefing",
      snippet: "The brigade supports engineering and logistics activities in the eastern corridor.",
      domainType: "official",
    },
    {
      url: "https://example.net/report",
      title: "Open source analysis",
      snippet:
        "Satellite observations align with reports showing activity near transport and supply routes.",
      domainType: "osint",
    },
  ],
}

function buildProposal(index: number): EnrichmentProposal {
  return {
    field: `field_${index}`,
    currentValue: `Current value ${index}`,
    proposedValue:
      index % 2 === 0
        ? `Updated value ${index} with extra context for readability checks.`
        : ["support", "armor", "recon", `tag-${index}`],
    reasoning:
      "This proposal is generated for Storybook visual QA to validate spacing, wrapping, and card alignment.",
    sources: [
      {
        url: `https://source.example.com/${index}`,
        title: `Source ${index} with a long title for truncation behavior validation in compact layouts`,
        snippet:
          "Long snippet content to verify line wrapping and clipping behavior inside source tags. ".repeat(
            8,
          ),
        domainType: index % 3 === 0 ? "official" : "web",
      },
      {
        url: `https://analysis.example.com/${index}`,
        title: `Analysis note ${index}`,
        snippet:
          "Secondary snippet with additional details to ensure nested expandable content remains stable while scrolling.",
        domainType: "news",
      },
    ],
  }
}

const manyProposals = Array.from({ length: 12 }, (_, index) => buildProposal(index + 1))

const baseArgs = {
  open: true,
  entity: baseEntity,
  context: baseContext,
  prompt:
    "Enrich this unit with recent role, deployment, and command structure updates from high-confidence public sources.",
  status: "idle" as const,
  queryTrace: [],
  depthUsed: 0,
  unresolvedFields: [],
  notes: "",
  proposals: [] as EnrichmentProposal[],
  decisions: {} as Record<string, "accepted" | "rejected" | "pending">,
  errorMessage: null as string | null,
  closeNotice: null as string | null,
  onClose: noop,
  onPromptChange: noop,
  onRun: noop,
  onAccept: noop,
  onReject: noop,
  onIgnore: noop,
}

const meta: Meta<typeof EnrichDrawer> = {
  title: "Inspector/Enrichment/EnrichDrawer",
  component: EnrichDrawer,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof EnrichDrawer>

export const Closed: Story = {
  args: {
    ...baseArgs,
    open: false,
  },
}

export const IdleReady: Story = {
  args: {
    ...baseArgs,
  },
}

export const RunningWithTrace: Story = {
  args: {
    ...baseArgs,
    status: "running",
    depthUsed: 2,
    queryTrace: [
      "5th Mechanized Brigade mission overview recent months",
      "5th Mechanized Brigade command structure verified sources",
      "2nd Division subordinate units sector update",
    ],
  },
}

export const FailedWithError: Story = {
  args: {
    ...baseArgs,
    status: "failed",
    errorMessage: "Provider timeout after 30s. Retry with a narrower query scope.",
  },
}

export const SuccessFewProposals: Story = {
  args: {
    ...baseArgs,
    status: "success",
    proposals: [
      baseProposal,
      {
        ...baseProposal,
        field: "militaryUnitId",
        currentValue: "MU-5MB",
        proposedValue: "MU-5MB-ALPHA",
      },
      {
        ...baseProposal,
        field: "sources",
        currentValue: "https://old-source.example",
        proposedValue: [
          "https://official-update.example",
          "https://news-brief.example",
          "Field report 17A",
        ],
      },
    ],
    decisions: {
      notes: "pending",
      militaryUnitId: "accepted",
      sources: "rejected",
    },
  },
}

export const PartialWithUnresolved: Story = {
  args: {
    ...baseArgs,
    status: "partial",
    proposals: [
      {
        ...baseProposal,
        field: "notes",
      },
    ],
    unresolvedFields: ["natoSymbolCode", "osmRelationId"],
    notes:
      "Partial results available. Conflicting source confidence for symbol code and relation mapping.",
    queryTrace: [
      "5th Mechanized Brigade symbol code",
      "5th Mechanized Brigade OSM relation",
    ],
    depthUsed: 3,
  },
}

export const LongScrollableContent: Story = {
  args: {
    ...baseArgs,
    status: "success",
    queryTrace: [
      "5th Mechanized Brigade deployment update",
      "2nd Division force composition",
      "Sector logistics and support network",
      "OSINT timeline with confidence notes",
      "Cross-validate historical references",
    ],
    depthUsed: 4,
    proposals: manyProposals,
    decisions: Object.fromEntries(
      manyProposals.map((proposal, index) => [
        proposal.field,
        index % 3 === 0 ? "accepted" : index % 3 === 1 ? "rejected" : "pending",
      ]),
    ) as Record<string, "accepted" | "rejected" | "pending">,
    unresolvedFields: ["domain", "type", "natoSymbolCode", "sources"],
    notes:
      "This scenario is intentionally dense to stress scroll containers and confirm there are no visual artifacts.",
  },
}

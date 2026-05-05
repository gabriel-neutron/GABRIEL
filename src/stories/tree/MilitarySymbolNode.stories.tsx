import type { Meta, StoryObj } from "@storybook/react-vite"
import ReactFlow, { type Node } from "reactflow"
import { MilitarySymbolNode, type MilitarySymbolNodeData } from "@/components/tree/MilitarySymbolNode"
import type { MapEntity } from "@/types/domain.types"

const entity: MapEntity = {
  id: "entity-symbol",
  name: "Recon Platoon",
  layerId: "layer-tree",
  parentId: null,
  type: "recon",
  affiliation: "Friend",
  domain: "Ground",
}

const nodes: Node<MilitarySymbolNodeData>[] = [
  {
    id: entity.id,
    type: "militarySymbol",
    position: { x: 0, y: 0 },
    data: { label: entity.name, entity },
  },
]

const meta = {
  title: "Tree/MilitarySymbolNode",
  render: () => (
    <div className="h-[220px] w-[220px] rounded-md border bg-background p-4">
      <ReactFlow nodes={nodes} edges={[]} nodeTypes={{ militarySymbol: MilitarySymbolNode }} fitView />
    </div>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

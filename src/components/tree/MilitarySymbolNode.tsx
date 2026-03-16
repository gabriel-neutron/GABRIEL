import { Handle, type NodeProps, Position } from "reactflow"
import { getRenderedSymbolForEntity } from "@/services/symbol.service"
import type { MapEntity } from "@/types/domain.types"

const TREE_SYMBOL_SIZE = 28

export type MilitarySymbolNodeData = {
  label: string
  entity: MapEntity
}

export function MilitarySymbolNode({ data }: NodeProps<MilitarySymbolNodeData>) {
  const entity = data.entity
  const { svg, width, height } = getRenderedSymbolForEntity(entity, TREE_SYMBOL_SIZE)

  return (
    <div
      className="relative flex shrink-0 items-center justify-center [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      style={{ width, height }}
      title={data.label}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}

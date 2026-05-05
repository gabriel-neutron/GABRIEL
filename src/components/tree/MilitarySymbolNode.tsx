import { memo, useMemo } from "react"
import { Handle, type NodeProps, Position } from "reactflow"
import { getRenderedSymbolForEntity } from "@/services/symbol.service"
import type { MapEntity } from "@/types/domain.types"

const TREE_SYMBOL_SIZE = 28

export type MilitarySymbolNodeData = {
  label: string
  entity: MapEntity
}

export const MilitarySymbolNode = memo(function MilitarySymbolNode({
  data,
}: NodeProps<MilitarySymbolNodeData>) {
  const { svg, width, height } = useMemo(
    () => getRenderedSymbolForEntity(data.entity, TREE_SYMBOL_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.entity.natoSymbolCode, data.entity.echelon, data.entity.affiliation, data.entity.domain],
  )

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
})

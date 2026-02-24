import type { NodeProps } from "reactflow"
import { getSymbolForUnit, mapEntityToSymbolInput, renderSymbol } from "@/services/symbol.service"
import type { MapEntity } from "@/types/domain.types"

const TREE_SYMBOL_SIZE = 28

export type MilitarySymbolNodeData = {
  label: string
  entity: MapEntity
}

export function MilitarySymbolNode({ data }: NodeProps<MilitarySymbolNodeData>) {
  const entity = data.entity
  const input = mapEntityToSymbolInput(entity)
  const { sidc, options } = getSymbolForUnit(input)
  const { svg, width, height } = renderSymbol(sidc, { ...options, size: TREE_SYMBOL_SIZE })

  return (
    <div
      className="flex shrink-0 items-center justify-center [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: svg }}
      title={data.label}
    />
  )
}

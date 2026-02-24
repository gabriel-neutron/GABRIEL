import type { NodeProps } from "reactflow"
import { getSymbolForUnit, renderSymbol } from "@/services/symbol.service"
import type { SymbolDomain, SymbolEchelon } from "@/types/symbol.types"
import type { MapEntity } from "@/types/domain.types"

const TREE_SYMBOL_SIZE = 28

export type MilitarySymbolNodeData = {
  label: string
  entity: MapEntity
}

function entityToSymbolInput(entity: MapEntity): Parameters<typeof getSymbolForUnit>[0] {
  return {
    unit: {
      id: entity.id,
      name: entity.name,
      type: entity.type ?? "unknown",
      parent_id: entity.parentId,
      nato_symbol_code: entity.natoSymbolCode ?? undefined,
    },
    affiliation: entity.affiliation ?? "Friend",
    echelon: (entity.echelon as SymbolEchelon) ?? undefined,
    domain: (entity.domain as SymbolDomain) ?? "Ground",
  }
}

export function MilitarySymbolNode({ data }: NodeProps<MilitarySymbolNodeData>) {
  const entity = data.entity
  const input = entityToSymbolInput(entity)
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

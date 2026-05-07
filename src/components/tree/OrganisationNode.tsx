import { memo } from "react"
import { Handle, type NodeProps, Position } from "reactflow"
import { ORGANISATION_TYPE_LABELS } from "@/types/organisation.types"
import type { Organisation } from "@/types/organisation.types"

export type OrganisationNodeData = {
  label: string
  organisation: Organisation
}

export const OrganisationNode = memo(function OrganisationNode({
  data,
}: NodeProps<OrganisationNodeData>) {
  const typeLabel = ORGANISATION_TYPE_LABELS[data.organisation.type] ?? data.organisation.type

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      title={`${data.label} — ${typeLabel}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <span className="text-[10px] font-bold leading-none">
          {data.label.charAt(0).toUpperCase()}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
})

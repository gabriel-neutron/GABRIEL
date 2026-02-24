import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MapEntity } from "@/types/domain.types"

type Props = {
  entities: MapEntity[]
  onCreateNew: () => void
  onLinkToExisting: (entityId: string) => void
  onCancel: () => void
}

export function GeometryActionMenu({
  entities,
  onCreateNew,
  onLinkToExisting,
  onCancel,
}: Props) {
  const [linkTarget, setLinkTarget] = useState<string>("__none__")

  function handleLinkChange(value: string) {
    setLinkTarget(value)
    if (value && value !== "__none__") {
      onLinkToExisting(value)
    }
  }

  return (
    <div className="absolute left-1/2 top-4 z-[1000] w-80 -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-3 text-sm font-medium">Geometry created</div>
      <div className="flex flex-col gap-3">
        <Button size="sm" onClick={onCreateNew}>
          Create new entity
        </Button>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Link to existing</span>
          <Select value={linkTarget} onValueChange={handleLinkChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose entity…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose entity…</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

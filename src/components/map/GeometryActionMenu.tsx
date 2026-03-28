import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { FilterableSelect } from "@/components/tree/FilterableSelect"
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
    if (value !== "__none__") onLinkToExisting(value)
  }

  return (
    <div className="absolute left-1/2 z-[1000] w-80 -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg">
      <FieldGroup>
        <Field>
          <Button size="sm" className="w-full" onClick={onCreateNew}>
            Create new entity
          </Button>
        </Field>
        <Field>
          <FieldLabel>Link to existing</FieldLabel>
          <FilterableSelect
            options={entities}
            value={linkTarget}
            onValueChange={handleLinkChange}
            placeholder="Choose entity..."
          />
        </Field>
        <Field>
          <Button size="sm" variant="ghost"onClick={onCancel}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </div>
  )
}
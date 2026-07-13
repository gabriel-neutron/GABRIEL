import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/ui/card"
import { Separator } from "@/ui/separator"
import { FilterableSelect } from "@/components/shared/FilterableSelect"
import type { MapEntity } from "@/types/domain.types"

type Props = {
  entities: MapEntity[]
  organisations: MapEntity[]
  onCreateNew: () => void
  onCreateNewOrganisation: () => void
  onLinkToExisting: (entityId: string) => void
  onCancel: () => void
}

export function GeometryActionMenu({
  entities,
  organisations,
  onCreateNew,
  onCreateNewOrganisation,
  onLinkToExisting,
  onCancel,
}: Props) {
  const [linkTarget, setLinkTarget] = useState<string>("__none__")

  function handleLinkChange(value: string) {
    setLinkTarget(value)
    if (value !== "__none__") onLinkToExisting(value)
  }

  const linkOptions = [
    ...entities.map((e) => ({ id: e.id, name: e.name, echelon: e.echelon, kind: "entity" as const })),
    ...organisations.map((o) => ({ id: o.id, name: o.name, kind: "organisation" as const })),
  ]

  return (
    <Card className="absolute left-1/2 z-[1000] w-80 -translate-x-1/2 py-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between px-4 pt-3 pb-2">
        <CardTitle className="text-base font-semibold">Geometry type</CardTitle>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onCancel}
          aria-label="Close geometry menu"
        >
          <X className="size-5" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onCreateNew}>
            + Military unit
          </Button>
          <Button className="w-full" variant="outline" onClick={onCreateNewOrganisation}>
            + Industrial entity
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground">Or</span>
          <Separator className="flex-1" />
        </div>

        <FilterableSelect
          options={linkOptions}
          value={linkTarget}
          onValueChange={handleLinkChange}
          placeholder="Link"
          className="w-full"
        />
      </CardContent>
    </Card>
  )
}
import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FilterableSelect } from "@/components/shared/FilterableSelect"
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
        <Button className="w-full" onClick={onCreateNew}>
          New
        </Button>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground">Or</span>
          <Separator className="flex-1" />
        </div>

        <FilterableSelect
          options={entities}
          value={linkTarget}
          onValueChange={handleLinkChange}
          placeholder="Link"
          className="w-full"
        />
      </CardContent>
    </Card>
  )
}
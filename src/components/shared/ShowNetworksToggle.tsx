import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type Props = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ShowNetworksToggle({ checked, onCheckedChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="show-networks"
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label htmlFor="show-networks" className="text-sm cursor-pointer select-none">
        Show Networks
      </Label>
    </div>
  )
}

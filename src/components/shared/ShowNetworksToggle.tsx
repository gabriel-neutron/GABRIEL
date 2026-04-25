import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useProjectStore } from "@/store/useProjectStore"

export function ShowNetworksToggle() {
  const showNetworks = useProjectStore((s) => s.showNetworks)
  const setShowNetworks = useProjectStore((s) => s.setShowNetworks)
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="show-networks"
        size="sm"
        checked={showNetworks}
        onCheckedChange={setShowNetworks}
      />
      <Label htmlFor="show-networks" className="text-sm cursor-pointer select-none">
        Show Networks
      </Label>
    </div>
  )
}

import { Network } from "lucide-react"
import { Button } from "@/ui/button"
import { useMapPrefsStore } from "@/store/useMapPrefsStore"

export function ShowNetworksToggle() {
  const showNetworks = useMapPrefsStore((s) => s.showNetworks)
  const setShowNetworks = useMapPrefsStore((s) => s.setShowNetworks)

  return (
    <Button
      type="button"
      size="icon"
      variant={showNetworks ? "secondary" : "outline"}
      onClick={() => setShowNetworks(!showNetworks)}
      aria-pressed={showNetworks}
      title={showNetworks ? "Networks enabled" : "Networks disabled"}
    >
      <Network className="h-4 w-4" />
      <span className="sr-only">
        {showNetworks ? "Disable network links" : "Enable network links"}
      </span>
    </Button>
  )
}

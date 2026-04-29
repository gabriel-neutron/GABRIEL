import { Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/store/useProjectStore"

export function ShowNetworksToggle() {
  const showNetworks = useProjectStore((s) => s.showNetworks)
  const setShowNetworks = useProjectStore((s) => s.setShowNetworks)

  return (
    <Button
      type="button"
      size="icon"
      variant={showNetworks ? "secondary" : "outline"}
      className={showNetworks ? "text-emerald-600 dark:text-emerald-400" : ""}
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

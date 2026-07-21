import { Separator } from "@/ui/separator"
import { SeedImportPanel } from "@/modules/telegram/ui/SeedImportPanel"
import { GraphSearch } from "@/modules/telegram/ui/GraphSearch"
import { OobProposals } from "@/modules/telegram/ui/OobProposals"

/** Combines the module's `leftPanels` sections into one tab rather than three, since
 * seed import, search, and OOB review are all small and related. */
export function TelegramPanel() {
  return (
    <div className="flex flex-col">
      <SeedImportPanel />
      <Separator />
      <div className="p-3 pb-0">
        <h3 className="text-sm font-medium">Search</h3>
      </div>
      <GraphSearch />
      <Separator />
      <div className="p-3 pb-0">
        <h3 className="text-sm font-medium">OOB match proposals</h3>
      </div>
      <OobProposals />
    </div>
  )
}

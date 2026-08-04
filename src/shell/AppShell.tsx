import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { Ellipsis, X } from "lucide-react"

import { Alert, AlertDescription } from "@/ui/alert"
import { Button } from "@/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs"
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/ui/sidebar"
import { Sheet, SheetContent, SheetTitle } from "@/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useTheme } from "@/provider/theme-provider"
import { AiProviderSettingsDialog } from "./AiProviderSettingsDialog"
import { useViewStore } from "./useViewStore"
import type { ModuleView } from "@/types/module.types"

export type ProjectFileActions = {
  onNewProject: () => void
  onOpenProject: (file: File) => void
  onSaveProject: () => void
  /** Writes a gated CC-BY release, which is a different act from saving the working file. */
  onExportRelease: () => void
}

type Props = {
  /** Fixed core "map" view + every module's `views` (ADR 0007), composed by `MainLayout`. */
  views: ModuleView[]
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  detailHeaderActions?: ReactNode
  headerPrimarySlot?: ReactNode
  headerSecondarySlot?: ReactNode
  headerMenuSlot?: ReactNode
  rightPanelOpen: boolean
  onCloseDetail: () => void
  busy: boolean
  error: string | null
  projectFileActions?: ProjectFileActions
  readOnly?: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
}

function StandaloneSidebarToggle() {
  const { open, isMobile } = useSidebar()
  if (open && !isMobile) return null

  return (
    <div className="absolute top-2 left-2 z-[5200]">
      <SidebarTrigger
        className="h-8 w-8 rounded border border-border bg-background text-foreground shadow-md hover:bg-accent hover:text-foreground [&>svg]:size-5"
      />
    </div>
  )
}

export function AppShell({
  views,
  leftSlot,
  rightSlot,
  detailHeaderActions,
  headerPrimarySlot,
  headerSecondarySlot,
  headerMenuSlot,
  rightPanelOpen,
  onCloseDetail,
  busy,
  error,
  projectFileActions,
  readOnly = false,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
}: Props) {
  const activeViewId = useViewStore((s) => s.activeViewId)
  const setActiveViewId = useViewStore((s) => s.setActiveViewId)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { theme } = useTheme()
  const isMobile = useIsMobile()
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0]

  useEffect(() => {
    if (rightPanelOpen) setMobileDetailOpen(true)
  }, [rightPanelOpen])

  function handleViewChange(value: string) {
    setActiveViewId(value)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file) projectFileActions?.onOpenProject(file)
    event.currentTarget.value = ""
  }

  function handleCloseDetail() {
    setMobileDetailOpen(false)
    onCloseDetail()
  }

  const headerActionButtons = readOnly ? (
    <>
      {onSwitchToEdit && (
        <Button type="button" size="sm" variant="outline" onClick={onSwitchToEdit} title="Switch to edit mode">
          Edit
        </Button>
      )}
      {onOpenAbout && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenAbout}
          title="About"
        >
          About
        </Button>
      )}
    </>
  ) : (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={projectFileActions?.onNewProject}
        title="New project"
      >
        New
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        title="Open project"
      >
        Open
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={projectFileActions?.onSaveProject}
        title="Save project"
      >
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={projectFileActions?.onExportRelease}
        // Saving writes the working file, which holds everything. Exporting writes a public
        // release, which does not — and the difference is the whole point of the gate, so the
        // two actions say so rather than sitting side by side as if they were variants.
        title="Export a gated CC BY 4.0 release. Unsourced and assessment-tier relationships are withheld."
      >
        Export
      </Button>
    </>
  )

  return (
    <SidebarProvider defaultOpen className="h-dvh flex-col bg-background text-foreground [--app-header-height:56px]">
      <header className="relative z-[100] border-b border-border">
        <div className="flex min-h-14 items-center justify-between gap-3 px-5 py-2">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src="/favicon.svg"
              alt="Gabriel"
              className={cn("h-8 w-8 shrink-0", theme === "dark" && "invert")}
              aria-hidden
            />
            <Tabs value={activeView.id} onValueChange={handleViewChange} className="hidden sm:block">
              <TabsList>
                {views.map((v) => (
                  <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="hidden min-w-0 flex-1 sm:block">{headerPrimarySlot}</div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {headerSecondarySlot}
            {headerActionButtons}
            {headerMenuSlot && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="outline" title="More actions">
                    <Ellipsis className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[10000] w-[320px]">
                  <div className="space-y-2 p-2">{headerMenuSlot}</div>
                  {!readOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => setAiSettingsOpen(true)}
                          title="Configure AI provider keys"
                        >
                          AI keys
                        </Button>
                      </div>
                    </>
                  )}
                  {!readOnly && onSwitchToView && (
                    <div className="p-2 pt-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={onSwitchToView}
                        title="Switch to view mode"
                      >
                        View mode
                      </Button>
                    </div>
                  )}
                  {!readOnly && onOpenAbout && (
                    <div className="p-2 pt-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={onOpenAbout}
                        title="About"
                      >
                        About
                      </Button>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex shrink-0 items-center sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="outline" title="Open mobile actions">
                  <Ellipsis className="h-4 w-4" />
                  <span className="sr-only">Open mobile actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[10000] w-[320px]">
                <div className="space-y-2 p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {views.map((v) => (
                      <Button
                        key={v.id}
                        type="button"
                        size="sm"
                        variant={activeView.id === v.id ? "default" : "outline"}
                        onClick={() => setActiveViewId(v.id)}
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>
                  {headerPrimarySlot}
                  {headerSecondarySlot}
                  <div className="flex flex-wrap gap-2">{headerActionButtons}</div>
                  {headerMenuSlot && (
                    <>
                      <DropdownMenuSeparator />
                      <div>{headerMenuSlot}</div>
                    </>
                  )}
                  {!readOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setAiSettingsOpen(true)}
                        title="Configure AI provider keys"
                      >
                        AI keys
                      </Button>
                    </>
                  )}
                  {!readOnly && onSwitchToView && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={onSwitchToView}
                      title="Switch to view mode"
                    >
                      View mode
                    </Button>
                  )}
                  {!readOnly && onOpenAbout && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={onOpenAbout}
                      title="About"
                    >
                      About
                    </Button>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {error && (
          <div className="px-5 pb-3">
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {!readOnly && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpkg,.sqlite,.db"
            className="hidden"
            onChange={handleFileChange}
          />
        )}
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {!activeView.hideSidebar && (
          <Sidebar
            collapsible="offcanvas"
            variant="sidebar"
            className="z-[90] top-[var(--app-header-height)] h-[calc(100dvh-var(--app-header-height))]"
          >
            <SidebarContent className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
              {leftSlot}
            </SidebarContent>
          </Sidebar>
        )}

        <main className="relative min-h-0 min-w-0 flex-1">
          {!activeView.hideSidebar && <StandaloneSidebarToggle />}
          <div className="h-full min-w-0">{activeView.content}</div>
        </main>

        <aside
          className={cn(
            "hidden min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-linear xl:flex",
            rightPanelOpen
              ? "w-[clamp(320px,24vw,460px)] min-w-[320px] max-w-[460px] translate-x-0 border-l border-border"
              : "w-0 min-w-0 max-w-0 translate-x-full border-l-0",
          )}
          aria-hidden={!rightPanelOpen}
        >
          {rightPanelOpen && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
              <div className="flex min-w-0 items-center gap-2">{detailHeaderActions}</div>
              <Button type="button" size="icon" variant="ghost" onClick={handleCloseDetail} title="Close detail">
                <X className="h-4 w-4" />
                <span className="sr-only">Close detail</span>
              </Button>
            </div>
          )}
          {rightPanelOpen && <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">{rightSlot}</div>}
        </aside>
      </div>

      <Sheet open={isMobile && rightPanelOpen && mobileDetailOpen} onOpenChange={(open) => !open && handleCloseDetail()}>
        <SheetContent side="right" showCloseButton={false} className="z-[5200] !h-dvh !w-dvw !max-w-none rounded-none p-0 xl:hidden">
          <SheetTitle className="sr-only">Detail</SheetTitle>
          <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
              <div className="flex min-w-0 items-center gap-2">{detailHeaderActions}</div>
              <Button type="button" size="icon" variant="ghost" onClick={handleCloseDetail} title="Close detail">
                <X className="h-4 w-4" />
                <span className="sr-only">Close detail</span>
              </Button>
            </div>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">{rightSlot}</div>
          </div>
        </SheetContent>
      </Sheet>
      <AiProviderSettingsDialog open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
    </SidebarProvider>
  )
}

import { useState, useRef, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useTheme } from "@/provider/theme-provider"
import { AiProviderSettingsDialog } from "./AiProviderSettingsDialog"

export type ProjectFileActions = {
  onNewProject: () => void
  onOpenProject: (file: File) => void
  onSaveProject: () => void
}

type Props = {
  mapSlot: ReactNode
  treeSlot: ReactNode
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  detailHeaderActions?: ReactNode
  headerSlot?: ReactNode
  selectedEntityId: string | null
  selectedOsmObject?: { type: "node" | "way" | "relation"; id: number } | null
  onCloseDetail: () => void
  busy: boolean
  error: string | null
  projectFileActions: ProjectFileActions
  readOnly?: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
}

export function AppShell({
  mapSlot,
  treeSlot,
  leftSlot,
  rightSlot,
  detailHeaderActions,
  headerSlot,
  selectedEntityId,
  selectedOsmObject,
  onCloseDetail,
  busy,
  error,
  projectFileActions,
  readOnly = false,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
}: Props) {
  const [activeView, setActiveView] = useState<"map" | "tree">("map")
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const rightPanelOpen = selectedEntityId !== null || selectedOsmObject !== null

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <div className="flex h-full min-w-0 flex-col">
        <header className="border-b border-border">
          <div className="flex h-14 items-center justify-between gap-4 px-5">
            <div className="flex items-center gap-3">
              <img
                src="/favicon.svg"
                alt="Gabriel"
                className={cn("h-8 w-8 shrink-0", isDark ? "invert" : "")}
                aria-hidden
              />
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
              <TabsList>
                <TabsTrigger value="map">Map</TabsTrigger>
                <TabsTrigger value="tree">Hierarchy</TabsTrigger>
              </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              {headerSlot}
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAiSettingsOpen(true)}
                  title="Configure AI provider keys"
                >
                  AI keys
                </Button>
              )}

              {onOpenAbout && (
                <Button type="button" size="sm" variant="outline" onClick={onOpenAbout} title="About">
                  About
                </Button>
              )}
              {readOnly ? (
                onSwitchToEdit && (
                  <Button type="button" size="sm" variant="secondary" onClick={onSwitchToEdit} title="Switch to edit mode">
                    Edit mode
                  </Button>
                )
              ) : (
                <>
                  {onSwitchToView && (
                    <Button type="button" size="sm" variant="outline" onClick={onSwitchToView} title="Switch to view mode">
                      View mode
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={projectFileActions.onNewProject}
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
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={projectFileActions.onSaveProject}
                    title="Save project"
                  >
                    Save
                  </Button>
                </>
              )}
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
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) projectFileActions.onOpenProject(file)
                e.currentTarget.value = ""
              }}
            />
          )}
        </header>

        <div
          className="grid min-h-0 min-w-0 flex-1"
          style={{
            gridTemplateColumns: `320px 1fr ${rightPanelOpen ? "360px" : "0px"}`,
          }}
        >
          <aside className="flex min-h-0 min-w-0 flex-col border-r border-border overflow-hidden">
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
              {leftSlot}
            </div>
          </aside>

          <main className="min-w-0">
            <div className="h-full min-w-0">{activeView === "map" ? mapSlot : treeSlot}</div>
          </main>

          <aside
            className={
              rightPanelOpen
                ? "flex min-h-0 min-w-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground overflow-hidden"
                : "hidden"
            }
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
              <div className="flex min-w-0 items-center gap-2">
                {detailHeaderActions}
              </div>
              <Button size="sm" variant="ghost" onClick={onCloseDetail} title="Close detail">
                Close
              </Button>
            </div>
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
              {rightSlot}
            </div>
          </aside>
        </div>
      </div>
      <AiProviderSettingsDialog
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
      />
    </div>
  )
}

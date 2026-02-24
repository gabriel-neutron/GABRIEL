import { useState, useRef, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Props = {
  mapSlot: ReactNode
  treeSlot: ReactNode
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  headerSlot?: ReactNode
  selectedEntityId: string | null
  selectedOsmObject?: { type: "node" | "way" | "relation"; id: number } | null
  onCloseDetail: () => void
  busy: boolean
  error: string | null
  onNewProject: () => void
  onOpenProject: (file: File) => void
  onSaveProject: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  historyBusy: boolean
  historyError: string | null
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
  headerSlot,
  selectedEntityId,
  selectedOsmObject,
  onCloseDetail,
  busy,
  error,
  onNewProject,
  onOpenProject,
  onSaveProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyBusy,
  historyError,
  readOnly = false,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
}: Props) {
  const [activeView, setActiveView] = useState<"map" | "tree">("map")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const rightPanelOpen = selectedEntityId !== null || selectedOsmObject !== null

  return (
    <div className="h-dvh w-dvw bg-background text-foreground">
      <div className="flex h-full min-w-0 flex-col">
        <header className="border-b border-border">
          <div className="flex h-14 items-center justify-between gap-4 px-5">

            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
              <TabsList>
                <TabsTrigger value="map">Map</TabsTrigger>
                <TabsTrigger value="tree">Hierarchy</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {headerSlot}

              {onOpenAbout && (
                <Button type="button" size="sm" variant="outline" onClick={onOpenAbout} title="About">
                  About
                </Button>
              )}
              {readOnly ? (
                <>
                  {onSwitchToEdit && (
                    <Button type="button" size="sm" variant="secondary" onClick={onSwitchToEdit} title="Switch to edit mode">
                      Edit mode
                    </Button>
                  )}
                </>
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
                    onClick={() => onNewProject()}
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
                    onClick={onSaveProject}
                    title="Save project"
                  >
                    Save
                  </Button>
                  <div className="mx-1 h-6 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onUndo}
                    disabled={!canUndo || historyBusy}
                    title={historyError ?? "Undo"}
                  >
                    Undo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRedo}
                    disabled={!canRedo || historyBusy}
                    title={historyError ?? "Redo"}
                  >
                    Redo
                  </Button>
                </>
              )}
            </div>
          </div>

          {error ? (
            <div className="px-5 pb-3">
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {!readOnly && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpkg,.sqlite,.db"
              className="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) onOpenProject(file)
                e.currentTarget.value = ""
              }}
            />
          )}
        </header>

        <div
          className="grid min-w-0 flex-1"
          style={{
            gridTemplateColumns: `320px 1fr ${
              rightPanelOpen ? "360px" : "0px"
            }`,
          }}
        >
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border">
            <div className="min-h-0 flex-1 overflow-auto">{leftSlot}</div>
          </aside>

          <main className="min-w-0">
            <div className="h-full min-w-0">{activeView === "map" ? mapSlot : treeSlot}</div>
          </main>

          <aside
            className={
              rightPanelOpen ? "flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-sidebar text-sidebar-foreground" : "hidden"
            }
          >
            <div className="flex shrink-0 items-center justify-end border-b border-border px-2 py-1">
              <Button size="sm" variant="ghost" onClick={onCloseDetail} title="Close detail">
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">{rightSlot}</div>
          </aside>
        </div>
      </div>
    </div>
  )
}

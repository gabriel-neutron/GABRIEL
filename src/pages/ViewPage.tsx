import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { MainLayout } from "@/components/shared/MainLayout"
import type { ProjectFileActions } from "@/components/shared/AppShell"
import { loadGeoPackage, applyGeoPackageResult } from "@/services/geopackage.service"
import { useProjectStore } from "@/store/useProjectStore"
import { useEnrichment } from "@/hooks/useEnrichment"

export type ViewPageProps = {
  onEditMode?: () => void
  onOpenAbout?: () => void
}

const READ_ONLY_FILE_ACTIONS: ProjectFileActions = {
  onNewProject: () => {},
  onOpenProject: (_file: File) => {},
  onSaveProject: () => {},
}

export function ViewPage({ onEditMode, onOpenAbout }: ViewPageProps): React.ReactElement {
  const [projectLoading, setProjectLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { entities, drawnGeometries, selectedEntityId } = useProjectStore()

  const enrichment = useEnrichment({
    entities,
    drawnGeometries,
    selectedEntityId,
    onApplyAccepted: () => {},
  })

  useEffect(function loadDemoProject() {
    let mounted = true
    const controller = new AbortController()
    setProjectLoading(true)
    fetch("/project.gpkg", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load demo project")
        return res.arrayBuffer()
      })
      .then((buffer) => loadGeoPackage(buffer))
      .then((result) => {
        if (!mounted) return
        const next = applyGeoPackageResult(result, null)
        useProjectStore.getState().setProject({
          layers: next.layers,
          entities: next.entities,
          drawnGeometries: next.drawnGeometries,
          selectedEntityId: next.selectedEntityId,
          sourceCache: result.sourceCache,
        })
        setLoadError(null)
      })
      .catch((e) => {
        if (!mounted || (e instanceof Error && e.name === "AbortError")) return
        setLoadError(e instanceof Error ? e.message : "Failed to load demo")
        console.error("ViewPage load project.gpkg failed", e)
      })
      .finally(() => {
        if (mounted) setProjectLoading(false)
      })
    return () => {
      mounted = false
      controller.abort()
    }
  }, [])

  if (loadError !== null) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-background p-4 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    )
  }

  if (projectLoading) {
    return (
      <div className="flex h-dvh w-dvw flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm">Loading project…</p>
      </div>
    )
  }

  return (
    <MainLayout
      readOnly
      onOpenAbout={onOpenAbout}
      onSwitchToEdit={onEditMode}
      busy={false}
      error={null}
      projectFileActions={READ_ONLY_FILE_ACTIONS}
      enrichment={{
        isDrawerOpen: enrichment.isDrawerOpen,
        selectedEntity: enrichment.selectedEntity,
        context: enrichment.context,
        overlay: enrichment.overlay,
        prompt: enrichment.draftPrompt,
        status: enrichment.state.run.status,
        queryTrace: enrichment.state.run.queryTrace,
        depthUsed: enrichment.state.run.depthUsed,
        unresolvedFields: enrichment.state.run.unresolvedFields,
        notes: enrichment.state.run.notes,
        proposals: enrichment.state.run.proposals,
        decisions:
          enrichment.selectedEntityId == null
            ? {}
            : enrichment.state.decisions[enrichment.selectedEntityId] ?? {},
        errorMessage: enrichment.state.run.error?.details ?? null,
        closeNotice: enrichment.closeNotice,
        setPrompt: enrichment.setDraftPrompt,
        openDrawer: enrichment.openDrawer,
        closeDrawer: enrichment.closeDrawer,
        run: enrichment.run,
        accept: enrichment.accept,
        reject: enrichment.reject,
        ignore: enrichment.ignore,
        clearOverlayForSelected: enrichment.clearOverlayForSelected,
      }}
    />
  )
}

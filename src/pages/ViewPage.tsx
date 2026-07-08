import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { MainLayout } from "@/shell/MainLayout"
import { loadGeoPackage, applyGeoPackageResult } from "@/core/persistence/geopackage"
import { useProjectStore } from "@/store/useProjectStore"
import { useEnrichment } from "@/modules/enrichment/hooks/useEnrichment"

export type ViewPageProps = {
  onEditMode?: () => void
  onOpenAbout?: () => void
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
          organisations: next.organisations,
          drawnGeometries: next.drawnGeometries,
          selectedEntityId: next.selectedEntityId,
          selectedOrganisationId: next.selectedOrganisationId,
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
      enrichment={{
        isDrawerOpen: enrichment.isDrawerOpen,
        selectedEntity: enrichment.selectedEntity,
        context: enrichment.context,
        overlay: enrichment.overlay,
        prompt: enrichment.draftPrompt,
        status: enrichment.runStatus,
        queryTrace: enrichment.queryTrace,
        depthUsed: enrichment.depthUsed,
        unresolvedFields: enrichment.unresolvedFields,
        unresolvedReasons: enrichment.unresolvedReasons,
        conflicts: enrichment.conflicts,
        notes: enrichment.notes,
        proposals: enrichment.proposals,
        decisions: enrichment.decisions,
        errorMessage: enrichment.runError,
        closeNotice: enrichment.closeNotice,
        setPrompt: enrichment.setDraftPrompt,
        openDrawer: enrichment.openDrawer,
        closeDrawer: enrichment.closeDrawer,
        run: enrichment.run,
        accept: enrichment.accept,
        reject: enrichment.reject,
        clearOverlayForSelected: enrichment.clearOverlayForSelected,
      }}
    />
  )
}

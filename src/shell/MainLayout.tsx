import { useCallback, useMemo, useRef, useState } from "react"
import { MapView } from "@/core/map/MapView"
import { EnrichDrawer } from "@/modules/enrichment/ui/EnrichDrawer"
import { ResearchDialog } from "@/components/shared/ResearchDialog"
import { AppShell, type ProjectFileActions } from "./AppShell"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"
import { BaseMapSwitcher } from "@/components/shared/BaseMapSwitcher"
import { ModeToggle } from "@/components/shared/ModeToggle"
import { UnifiedSearch, type FlyToFn } from "@/components/shared/UnifiedSearch"
import { Button } from "@/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs"
import { SidebarGroup, SidebarGroupContent, SidebarTrigger } from "@/ui/sidebar"
import { FlaskConical } from "lucide-react"
import type { MapEntity, DrawnGeometry } from "@/types/domain.types"
import { getDefaultEntityLayerId } from "./entityLayer"
import type { EnrichmentControls, LayeredResearchControls } from "@/types/layout.types"
import { useProjectStore } from "@/store/useProjectStore"
import { useSelectedRef } from "@/store/useSelectedRef"
import { selectEntity, clearSelection } from "@/core/map/selection"
import { modules, detailRenderers } from "./moduleRegistry"
import { ModuleContext } from "./moduleContext"
import { CommandPalette } from "./CommandPalette"

export type { EnrichmentControls, LayeredResearchControls }

function entityFromGeometry(
  geom: DrawnGeometry,
  defaultLayerId: string,
  parentId: string | null,
): MapEntity {
  const id = crypto.randomUUID()
  const layerId = geom.layerId ?? defaultLayerId
  return {
    kind: "unit",
    id,
    name: "New entity",
    layerId,
    parentId,
    affiliation: "Hostile",
    isExactPosition: false,
  }
}

export type MainLayoutProps = {
  readOnly: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
  projectFileActions?: ProjectFileActions
  busy: boolean
  error: string | null
  enrichment: EnrichmentControls
  layeredResearch?: LayeredResearchControls
  restoredFromSession?: boolean
  onOverpassUnavailable?: () => void
  onCreateNewOrganisation?: (geom: DrawnGeometry) => void
}

export function MainLayout({
  readOnly,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
  projectFileActions,
  busy,
  error,
  enrichment,
  layeredResearch,
  restoredFromSession = false,
  onOverpassUnavailable,
  onCreateNewOrganisation,
}: MainLayoutProps): React.ReactElement {
  const { layers, entities, claims, selectedEntityId } = useProjectStore()
  const selectedRef = useSelectedRef()
  const handleCloseDetail = useCallback(() => {
    clearSelection()
  }, [])

  const flyToRef = useRef<FlyToFn | null>(null)

  const leftPanels = [
    { id: "layers", label: "Layers", content: <LayersPanel readOnly={readOnly} /> },
    ...modules.flatMap((m) => m.leftPanels ?? []),
  ]
  const [leftPanelId, setLeftPanelId] = useState(leftPanels[0].id)
  const activeLeftPanel = leftPanels.find((p) => p.id === leftPanelId) ?? leftPanels[0]

  const handleCreateNewEntity = useCallback((geom: DrawnGeometry): void => {
    const s = useProjectStore.getState()
    const defaultLayerId = getDefaultEntityLayerId(s.layers)
    const entity = entityFromGeometry(geom, defaultLayerId, s.selectedEntityId)
    s.addEntity(entity)
    s.addGeometry({ ...geom, entityId: entity.id })
    selectEntity(entity.id)
  }, [])

  const handleLinkGeometryToEntity = useCallback((geom: DrawnGeometry, entityId: string): void => {
    const s = useProjectStore.getState()
    s.addGeometry({ ...geom, entityId })
    s.updateEntity(entityId, { positionMode: "own" })
    selectEntity(entityId)
  }, [])

  const defaultLayerId = getDefaultEntityLayerId(layers)
  const selectedEntity = selectedEntityId != null ? entities.find((e) => e.id === selectedEntityId) ?? null : null

  const views = [
    {
      id: "map",
      label: "Map",
      content: (
        <MapView
          readOnly={readOnly}
          onCreateNewEntity={handleCreateNewEntity}
          onCreateNewOrganisation={onCreateNewOrganisation}
          onLinkGeometryToEntity={handleLinkGeometryToEntity}
          defaultLayerId={defaultLayerId}
          onOverpassUnavailable={onOverpassUnavailable}
          flyToRef={flyToRef}
          mapLayers={modules.flatMap((m) => m.mapLayers ?? [])}
        />
      ),
    },
    ...modules.flatMap((m) => m.views ?? []),
  ]

  const renderers = detailRenderers()
  const detailContent = selectedRef ? (renderers[selectedRef.kind]?.(selectedRef.id) ?? null) : null

  const moduleContextValue = useMemo(
    () => ({ readOnly, enrichedOverlay: enrichment.overlay }),
    [readOnly, enrichment.overlay],
  )

  return (
    <ModuleContext.Provider value={moduleContextValue}>
      <AppShell
        readOnly={readOnly}
        onOpenAbout={onOpenAbout}
        onSwitchToEdit={onSwitchToEdit}
        onSwitchToView={onSwitchToView}
        views={views}
        leftSlot={
          <SidebarGroup className="h-full gap-2 p-0">
            <div className="shrink-0 border-b border-border px-3 py-2">
              <Tabs value={leftPanelId} onValueChange={setLeftPanelId}>
                <div className="flex items-center gap-2">
                  <TabsList className="w-full">
                    {leftPanels.map((p) => (
                      <TabsTrigger key={p.id} value={p.id} className="flex-1 text-xs">{p.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  <SidebarTrigger className="h-8 w-8 shrink-0 [&>svg]:size-5" />
                </div>
              </Tabs>
            </div>
            <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
              {activeLeftPanel.content}
            </SidebarGroupContent>
          </SidebarGroup>
        }
        headerPrimarySlot={
          <div className="flex min-w-0 items-center gap-2">
            {!readOnly && (
              <div className="w-full max-w-[340px]">
                <UnifiedSearch flyToRef={flyToRef} />
              </div>
            )}
            {!readOnly && restoredFromSession && (
              <span className="text-muted-foreground text-xs">Project restored from last session</span>
            )}
          </div>
        }
        headerSecondarySlot={
          <div className="flex flex-wrap items-center gap-2">
            <BaseMapSwitcher />
            <ShowNetworksToggle />
            {!readOnly && layeredResearch && (
              <Button
                type="button"
                size="icon"
                variant={layeredResearch.status === "running" ? "secondary" : "outline"}
                onClick={layeredResearch.openDialog}
                title={
                  layeredResearch.status === "running"
                    ? "Research all entities (running)"
                    : layeredResearch.reviewQueueLength > 0
                      ? `Review research queue (${layeredResearch.reviewQueueLength})`
                      : "Research all entities"
                }
              >
                <FlaskConical />
                <span className="sr-only">
                  {layeredResearch.status === "running" ? "Researching entities" : "Research all entities"}
                </span>
              </Button>
            )}
            <ModeToggle />
          </div>
        }
        headerMenuSlot={
          !readOnly ? (
            <>
              {modules
                .filter((m) => m.headerContribution)
                .map((m, i) => <div key={i}>{m.headerContribution}</div>)}
            </>
          ) : null
        }
        rightPanelOpen={selectedRef !== null}
        onCloseDetail={handleCloseDetail}
        detailHeaderActions={
          // Enrichment only runs against unit entities (useEnrichment's underlying
          // entities list is unit-only) — hide the trigger for a corporate selection
          // rather than opening a drawer that can't find its entity.
          !readOnly && selectedEntity?.kind === "unit" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={enrichment.openDrawer}
            >
              Enrich with AI
            </Button>
          ) : null
        }
        rightSlot={detailContent}
        busy={busy}
        error={error}
        projectFileActions={projectFileActions}
      />
      {layeredResearch && (
        <ResearchDialog
          open={layeredResearch.dialogOpen}
          onClose={layeredResearch.closeDialog}
          entities={entities}
          claims={claims}
          entityStatuses={layeredResearch.entityStatuses}
          totalUsage={layeredResearch.totalUsage}
          cacheAdditions={layeredResearch.cacheAdditions}
          lastStats={layeredResearch.lastStats}
          runStatus={layeredResearch.status}
          progress={layeredResearch.progress}
          reviewQueueLength={layeredResearch.reviewQueueLength}
          batchSize={layeredResearch.batchSize}
          setBatchSize={layeredResearch.setBatchSize}
          richnessThreshold={layeredResearch.richnessThreshold}
          setRichnessThreshold={layeredResearch.setRichnessThreshold}
          skipAnalyzedWithinDays={layeredResearch.skipAnalyzedWithinDays}
          setSkipAnalyzedWithinDays={layeredResearch.setSkipAnalyzedWithinDays}
          hasProcessedEntities={layeredResearch.hasProcessedEntities}
          onRun={layeredResearch.onRun}
          onCancel={layeredResearch.onCancel}
          onReviewNext={layeredResearch.onReviewNext}
        />
      )}
      <EnrichDrawer
        open={enrichment.isDrawerOpen}
        entity={enrichment.selectedEntity}
        context={enrichment.context}
        prompt={enrichment.prompt}
        status={enrichment.status}
        queryTrace={enrichment.queryTrace}
        depthUsed={enrichment.depthUsed}
        unresolvedFields={enrichment.unresolvedFields}
        unresolvedReasons={enrichment.unresolvedReasons}
        conflicts={enrichment.conflicts}
        notes={enrichment.notes}
        proposals={enrichment.proposals}
        decisions={enrichment.decisions}
        errorMessage={enrichment.errorMessage}
        closeNotice={enrichment.closeNotice}
        onClose={enrichment.closeDrawer}
        onPromptChange={enrichment.setPrompt}
        onRun={enrichment.run}
        onAccept={(field) => {
          const proposal = enrichment.proposals.find((item) => item.field === field)
          if (proposal) enrichment.accept(proposal)
        }}
        onReject={(field) => {
          const proposal = enrichment.proposals.find((item) => item.field === field)
          if (proposal) enrichment.reject(proposal)
        }}
      />
      <CommandPalette readOnly={readOnly} />
    </ModuleContext.Provider>
  )
}

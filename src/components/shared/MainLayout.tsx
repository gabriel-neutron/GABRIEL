import { useState, useCallback } from "react"
import { MapView } from "@/components/map/MapView"
import { EntityInspector } from "@/components/inspector/EntityInspector"
import { EnrichDrawer } from "@/components/enrichment"
import { OsmObjectInspector } from "@/components/inspector/OsmObjectInspector"
import { ResearchDialog } from "@/components/shared/ResearchDialog"
import { AppShell, type ProjectFileActions } from "@/components/shared/AppShell"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { HierarchyPanel } from "@/components/shared/HierarchyPanel"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"
import { TreeView } from "@/components/tree/TreeView"
import { OsmQueryMenu } from "@/components/shared/OsmQueryMenu"
import { BaseMapSwitcher } from "@/components/shared/BaseMapSwitcher"
import { ModeToggle } from "@/components/shared/ModeToggle"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MapEntity, DrawnGeometry } from "@/types/domain.types"
import { getDefaultEntityLayerId } from "@/utils/entityLayer"
import type { EnrichmentControls, LayeredResearchControls } from "@/types/layout.types"
import { useProjectStore } from "@/store/useProjectStore"

export type { EnrichmentControls, LayeredResearchControls }

function entityFromGeometry(
  geom: DrawnGeometry,
  defaultLayerId: string,
  parentId: string | null,
): MapEntity {
  const id = crypto.randomUUID()
  const layerId = geom.layerId ?? defaultLayerId
  return {
    id,
    name: "New entity",
    layerId,
    parentId,
    affiliation: "Hostile",
    isExactPosition: false,
  }
}

function collectDescendants(entities: MapEntity[], rootId: string): string[] {
  const result: string[] = [rootId]
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const e of entities) {
      if (e.parentId === current) {
        result.push(e.id)
        queue.push(e.id)
      }
    }
  }
  return result
}

export type MainLayoutProps = {
  readOnly: boolean
  onOpenAbout?: () => void
  onSwitchToEdit?: () => void
  onSwitchToView?: () => void
  projectFileActions: ProjectFileActions
  busy: boolean
  error: string | null
  enrichment: EnrichmentControls
  layeredResearch?: LayeredResearchControls
  restoredFromSession?: boolean
  onOverpassUnavailable?: () => void
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
}: MainLayoutProps): React.ReactElement {
  const {
    layers,
    entities,
    selectedEntityId,
    selectedOsmObject,
    addLayer,
    closeDetail,
  } = useProjectStore()

  const [leftMode, setLeftMode] = useState<"layers" | "hierarchy">("layers")
  const [hiddenEntityIds, setHiddenEntityIds] = useState<Set<string>>(new Set())

  function handleToggleEntityVisible(entityId: string, visible: boolean) {
    const affected = collectDescendants(entities, entityId)
    setHiddenEntityIds((prev) => {
      const next = new Set(prev)
      affected.forEach((id) => (visible ? next.delete(id) : next.add(id)))
      return next
    })
  }

  const handleCreateNewEntity = useCallback((geom: DrawnGeometry): void => {
    const s = useProjectStore.getState()
    const defaultLayerId = getDefaultEntityLayerId(s.layers)
    const entity = entityFromGeometry(geom, defaultLayerId, s.selectedEntityId)
    s.addEntity(entity)
    s.addGeometry({ ...geom, entityId: entity.id })
    s.setSelectedOsmObject(null)
    s.setSelectedEntityId(entity.id)
  }, [])

  const handleLinkGeometryToEntity = useCallback((geom: DrawnGeometry, entityId: string): void => {
    const s = useProjectStore.getState()
    s.addGeometry({ ...geom, entityId })
    s.setSelectedOsmObject(null)
    s.setSelectedEntityId(entityId)
  }, [])

  const defaultLayerId = getDefaultEntityLayerId(layers)

  return (
    <>
      <AppShell
        readOnly={readOnly}
        onOpenAbout={onOpenAbout}
        onSwitchToEdit={onSwitchToEdit}
        onSwitchToView={onSwitchToView}
        mapSlot={
        <MapView
          readOnly={readOnly}
          onCreateNewEntity={handleCreateNewEntity}
          onLinkGeometryToEntity={handleLinkGeometryToEntity}
          defaultLayerId={defaultLayerId}
          hiddenEntityIds={hiddenEntityIds}
          onOverpassUnavailable={onOverpassUnavailable}
        />
      }
      treeSlot={<TreeView />}
      leftSlot={
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <Tabs value={leftMode} onValueChange={(v) => setLeftMode(v as typeof leftMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="layers" className="flex-1 text-xs">Layers</TabsTrigger>
                <TabsTrigger value="hierarchy" className="flex-1 text-xs">Army</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {leftMode === "layers" ? (
              <LayersPanel readOnly={readOnly} />
            ) : (
              <HierarchyPanel
                hiddenEntityIds={hiddenEntityIds}
                onToggleEntityVisible={handleToggleEntityVisible}
              />
            )}
          </div>
        </div>
      }
      headerSlot={
        <>
          {!readOnly && restoredFromSession && (
            <span className="text-muted-foreground text-xs">Project restored from last session</span>
          )}
          <ShowNetworksToggle />
          <BaseMapSwitcher />
          {!readOnly && <OsmQueryMenu layers={layers} onAddLayer={addLayer} />}
          {!readOnly && layeredResearch && (
            <Button
              type="button"
              size="sm"
              variant={layeredResearch.status === "running" ? "secondary" : "outline"}
              onClick={layeredResearch.openDialog}
              title="Research all entities layer by layer"
            >
              {layeredResearch.status === "running"
                ? "Researching…"
                : layeredResearch.reviewQueueLength > 0
                  ? `Review (${layeredResearch.reviewQueueLength})`
                  : "Research all"}
            </Button>
          )}
          <ModeToggle />
        </>
      }
      selectedEntityId={selectedEntityId}
      selectedOsmObject={selectedOsmObject}
      onCloseDetail={closeDetail}
      detailHeaderActions={
        !readOnly && selectedEntityId !== null && selectedOsmObject === null ? (
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
        rightSlot={
          selectedOsmObject ? (
            <OsmObjectInspector
              type={selectedOsmObject.type}
              id={selectedOsmObject.id}
              cachedFeature={selectedOsmObject.cachedFeature}
            />
          ) : (
            <EntityInspector
              key={selectedEntityId ?? "none"}
              readOnly={readOnly}
              enrichedOverlay={enrichment.overlay}
            />
          )
        }
        busy={busy}
        error={error}
        projectFileActions={projectFileActions}
      />
      {layeredResearch && (
        <ResearchDialog
          open={layeredResearch.dialogOpen}
          onClose={layeredResearch.closeDialog}
          entities={entities}
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
        onIgnore={(field) => {
          const proposal = enrichment.proposals.find((item) => item.field === field)
          if (proposal) enrichment.ignore(proposal)
        }}
      />
    </>
  )
}

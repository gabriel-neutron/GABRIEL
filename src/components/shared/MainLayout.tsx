import { useState } from "react"
import { MapView } from "@/components/map/MapView"
import { EntityInspector } from "@/components/inspector/EntityInspector"
import { EnrichDrawer } from "@/components/inspector/enrichment"
import { OsmObjectInspector } from "@/components/inspector/OsmObjectInspector"
import { ResearchDialog } from "@/components/shared/ResearchDialog"
import { AppShell, type ProjectFileActions } from "@/components/shared/AppShell"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { HierarchyPanel } from "@/components/shared/HierarchyPanel"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"
import { TreeView } from "@/components/tree/TreeView"
import { OsmQueryMenu } from "@/components/shared/OsmQueryMenu"
import { BaseMapSwitcher, type BaseMapId } from "@/components/shared/BaseMapSwitcher"
import { ModeToggle } from "@/components/shared/ModeToggle"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import { getDefaultEntityLayerId } from "@/utils/entityLayer"
import type { SelectedOsmObject } from "@/hooks/useMapProjectState"
import type { EnrichmentContext, EnrichmentProposal } from "@/types/enrichment.types"
import type { EntityResearchStatus } from "@/hooks/useLayeredResearch"
import type { LayeredResearchResult } from "@/services/research/layered-research.service"

type LayeredResearchControls = {
  status: "idle" | "running" | "done" | "failed"
  progress: { entityId: string; name: string; layer: number; done: number; total: number } | null
  reviewQueueLength: number
  hasNextInQueue: boolean
  entityStatuses: Record<string, EntityResearchStatus>
  totalUsage: { inputTokens: number; outputTokens: number }
  cacheAdditions: Array<{ url: string; content: string }>
  lastStats: LayeredResearchResult["stats"] | null
  dialogOpen: boolean
  batchSize: number
  setBatchSize: (n: number) => void
  richnessThreshold: number
  setRichnessThreshold: (n: number) => void
  skipAnalyzedWithinDays: number
  setSkipAnalyzedWithinDays: (n: number) => void
  hasProcessedEntities: boolean
  openDialog: () => void
  closeDialog: () => void
  onRun: () => void
  onCancel: () => void
  onReviewNext: () => void
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
  layers: Layer[]
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  selectedEntityId: string | null
  setSelectedEntityId: (id: string | null) => void
  selectedOsmObject: SelectedOsmObject
  setSelectedOsmObject: (v: SelectedOsmObject) => void
  showNetworks: boolean
  setShowNetworks: (v: boolean) => void
  baseMap: BaseMapId
  setBaseMap: (v: BaseMapId) => void
  entityOsmGeometries: Record<string, GeoJSON.FeatureCollection>
  restoredFromSession?: boolean
  setLayerVisible: (id: string, visible: boolean) => void
  removeLayer: (id: string) => void
  renameLayer: (layerId: string, name: string) => void
  addNewLayer: () => void
  handleDeleteEntity: (entityId: string) => void
  moveLayer: (layerId: string, direction: "up" | "down") => void
  addLayer: (layer: Layer) => void
  handleCreateNewEntity: (geom: DrawnGeometry) => void
  handleLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
  handleUpdateEntity: (entityId: string, patch: Partial<MapEntity>) => void
  handleDeleteGeometry: (geometryId: string) => void
  handleSelectOsmObject: (type: "node" | "way" | "relation", id: number, cachedFeature?: GeoJSON.Feature & { id?: string }) => void
  handleCloseDetail: () => void
  busy: boolean
  error: string | null
  projectFileActions: ProjectFileActions
  enrichment: {
    isDrawerOpen: boolean
    selectedEntity: MapEntity | null
    context: EnrichmentContext | null
    overlay: Record<string, unknown>
    prompt: string
    status: "idle" | "running" | "success" | "partial" | "failed"
    queryTrace: string[]
    depthUsed: number
    unresolvedFields: string[]
    notes: string
    proposals: EnrichmentProposal[]
    decisions: Record<string, "accepted" | "rejected" | "pending">
    errorMessage: string | null
    closeNotice: string | null
    setPrompt: (value: string) => void
    openDrawer: () => void
    closeDrawer: () => void
    run: () => void
    accept: (proposal: EnrichmentProposal) => void
    reject: (proposal: EnrichmentProposal) => void
    ignore: (proposal: EnrichmentProposal) => void
    clearOverlayForSelected: () => void
  }
  layeredResearch?: LayeredResearchControls
}

export function MainLayout({
  readOnly,
  onOpenAbout,
  onSwitchToEdit,
  onSwitchToView,
  layers,
  entities,
  drawnGeometries,
  selectedEntityId,
  setSelectedEntityId,
  selectedOsmObject,
  setSelectedOsmObject,
  showNetworks,
  setShowNetworks,
  baseMap,
  setBaseMap,
  entityOsmGeometries,
  restoredFromSession = false,
  setLayerVisible,
  removeLayer,
  renameLayer,
  addNewLayer,
  handleDeleteEntity,
  moveLayer,
  addLayer,
  handleCreateNewEntity,
  handleLinkGeometryToEntity,
  handleUpdateEntity,
  handleDeleteGeometry,
  handleSelectOsmObject,
  handleCloseDetail,
  busy,
  error,
  projectFileActions,
  enrichment,
  layeredResearch,
}: MainLayoutProps) {
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

  const defaultLayerId = getDefaultEntityLayerId(layers)
  const assignableLayers = layers.filter((l) => l.osmData == null)

  const handleSelectEntity = (id: string | null) => {
    setSelectedEntityId(id)
    setSelectedOsmObject(null)
  }

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
          layers={layers}
          entities={entities}
          drawnGeometries={drawnGeometries}
          entityOsmGeometries={entityOsmGeometries}
          onCreateNewEntity={handleCreateNewEntity}
          onLinkGeometryToEntity={handleLinkGeometryToEntity}
          defaultLayerId={defaultLayerId}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
          onSelectOsmObject={handleSelectOsmObject}
          showNetworks={showNetworks}
          baseMap={baseMap}
          hiddenEntityIds={hiddenEntityIds}
        />
      }
      treeSlot={
        <TreeView
          entities={entities}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
        />
      }
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
              <LayersPanel
                readOnly={readOnly}
                layers={layers}
                entities={entities}
                selectedEntityId={selectedEntityId}
                onSelectEntity={handleSelectEntity}
                onToggleVisible={setLayerVisible}
                onRemoveLayer={removeLayer}
                onRenameLayer={renameLayer}
                onAddLayer={addNewLayer}
                onRemoveEntity={handleDeleteEntity}
                onMoveLayer={moveLayer}
              />
            ) : (
              <HierarchyPanel
                entities={entities}
                selectedEntityId={selectedEntityId}
                hiddenEntityIds={hiddenEntityIds}
                onSelectEntity={handleSelectEntity}
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
          <ShowNetworksToggle checked={showNetworks} onCheckedChange={setShowNetworks} />
          <BaseMapSwitcher value={baseMap} onValueChange={setBaseMap} />
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
      onCloseDetail={handleCloseDetail}
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
              readOnly={readOnly}
              selectedEntityId={selectedEntityId}
              entities={entities}
              layers={assignableLayers}
              drawnGeometries={drawnGeometries}
              enrichedOverlay={enrichment.overlay}
              onUpdateEntity={handleUpdateEntity}
              onDeleteEntity={handleDeleteEntity}
              onDeleteGeometry={handleDeleteGeometry}
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

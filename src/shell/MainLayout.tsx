import { useState, useCallback, useRef } from "react"
import { MapView } from "@/core/map/MapView"
import { EntityInspector } from "@/modules/orbat/ui/EntityInspector"
import { OrganisationInspector } from "@/components/inspector/OrganisationInspector"
import { EnrichDrawer } from "@/modules/enrichment/ui/EnrichDrawer"
import { OsmObjectInspector } from "@/modules/osm/ui/OsmObjectInspector"
import { ResearchDialog } from "@/components/shared/ResearchDialog"
import { AppShell, type ProjectFileActions } from "./AppShell"
import { LayersPanel } from "@/components/shared/LayersPanel"
import { HierarchyPanel } from "@/modules/orbat/ui/HierarchyPanel"
import { ShowNetworksToggle } from "@/components/shared/ShowNetworksToggle"
import { TreeView } from "@/modules/orbat/ui/TreeView"
import { OsmQueryMenu } from "@/modules/osm/ui/OsmQueryMenu"
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
  const {
    layers,
    entities,
    selectedEntityId,
    selectedOrganisationId,
    selectedOsmObject,
    addLayer,
    closeDetail,
  } = useProjectStore()

  const flyToRef = useRef<FlyToFn | null>(null)

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
    const isOrg = s.organisations.some((o) => o.id === entityId)
    if (isOrg) {
      s.updateOrganisation(entityId, { positionMode: "own" })
      s.setSelectedOrganisationId(entityId)
      s.setSelectedEntityId(null)
    } else {
      s.updateEntity(entityId, { positionMode: "own" })
      s.setSelectedEntityId(entityId)
    }
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
            onCreateNewOrganisation={onCreateNewOrganisation}
            onLinkGeometryToEntity={handleLinkGeometryToEntity}
            defaultLayerId={defaultLayerId}
            hiddenEntityIds={hiddenEntityIds}
            onOverpassUnavailable={onOverpassUnavailable}
            flyToRef={flyToRef}
          />
        }
        treeSlot={<TreeView />}
        leftSlot={
          <SidebarGroup className="h-full gap-2 p-0">
            <div className="shrink-0 border-b border-border px-3 py-2">
              <Tabs value={leftMode} onValueChange={(value) => setLeftMode(value as typeof leftMode)}>
                <div className="flex items-center gap-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="layers" className="flex-1 text-xs">Layers</TabsTrigger>
                    <TabsTrigger value="hierarchy" className="flex-1 text-xs">Army</TabsTrigger>
                  </TabsList>
                  <SidebarTrigger className="h-8 w-8 shrink-0 [&>svg]:size-5" />
                </div>
              </Tabs>
            </div>
            <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
              {leftMode === "layers" ? (
                <LayersPanel readOnly={readOnly} />
              ) : (
                <HierarchyPanel hiddenEntityIds={hiddenEntityIds} onToggleEntityVisible={handleToggleEntityVisible} />
              )}
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
        headerMenuSlot={!readOnly ? <OsmQueryMenu layers={layers} onAddLayer={addLayer} /> : null}
        selectedEntityId={selectedEntityId}
        selectedOrganisationId={selectedOrganisationId}
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
          ) : selectedOrganisationId != null ? (
            <OrganisationInspector key={selectedOrganisationId} readOnly={readOnly} />
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
    </>
  )
}

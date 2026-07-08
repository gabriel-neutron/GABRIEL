import { useCallback, useMemo, useState } from "react"
import type { DrawnGeometry, PositionMode } from "@/types/domain.types"
import type { Organisation, OrganisationType } from "@/types/organisation.types"
import { useProjectStore } from "@/store/useProjectStore"
import { parse as parseSources } from "@/core/provenance/ledger"

const SOURCES_DELIMITER = "\n"

export type OrganisationInspectorState = {
  organisation: Organisation | null
  linkedGeometries: DrawnGeometry[]
  parentName: string | null
  typeValue: OrganisationType
  positionModeValue: PositionMode
  isExactPositionValue: boolean
  parentOptions: Organisation[]
  firstPoint: DrawnGeometry | undefined
  sourceEditor: {
    sources: string[]
    draft: string
    setDraft: (value: string) => void
    add: () => void
    remove: (index: number) => void
  }
  findDialogOpen: boolean
  setFindDialogOpen: (open: boolean) => void
  handleNameChange: (name: string) => void
  handleTypeChange: (type: OrganisationType) => void
  handlePositionModeChange: (mode: PositionMode) => void
  handleIsExactPositionChange: (value: boolean) => void
  handleParentChange: (parentId: string | null) => void
  handleSelectOsmRelation: (relationId: number) => void
}

export function useOrganisationInspector(): OrganisationInspectorState {
  const {
    selectedOrganisationId,
    organisations,
    drawnGeometries,
    updateOrganisation,
    deleteGeometry,
  } = useProjectStore()

  const [findDialogOpen, setFindDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState("")

  const organisation = selectedOrganisationId
    ? organisations.find((o) => o.id === selectedOrganisationId) ?? null
    : null

  const linkedGeometries = useMemo(
    () => (organisation ? drawnGeometries.filter((g) => g.entityId === organisation.id) : []),
    [organisation, drawnGeometries],
  )

  const parentName =
    organisation?.parentId != null
      ? organisations.find((o) => o.id === organisation.parentId)?.name ?? organisation.parentId
      : null

  const typeValue: OrganisationType = organisation?.type ?? "company"
  const positionModeValue: PositionMode = organisation?.positionMode ?? "own"
  const isExactPositionValue = organisation?.isExactPosition ?? false
  const parentOptions = organisation ? organisations.filter((o) => o.id !== organisation.id) : []
  const firstPoint = linkedGeometries.find((g) => g.type === "point")
  const sources = useMemo(() => (organisation ? parseSources(organisation.sources) : []), [organisation])

  const handleNameChange = useCallback(
    (name: string) => {
      if (!organisation) return
      updateOrganisation(organisation.id, { name })
    },
    [organisation, updateOrganisation],
  )

  const handleTypeChange = useCallback(
    (type: OrganisationType) => {
      if (!organisation) return
      updateOrganisation(organisation.id, { type })
    },
    [organisation, updateOrganisation],
  )

  const handlePositionModeChange = useCallback(
    (mode: PositionMode) => {
      if (!organisation) return
      updateOrganisation(organisation.id, {
        positionMode: mode,
        isExactPosition: mode === "own" ? (organisation.isExactPosition ?? false) : false,
      })
      if (mode !== "own") {
        for (const g of linkedGeometries) deleteGeometry(g.id)
      }
    },
    [organisation, linkedGeometries, updateOrganisation, deleteGeometry],
  )

  const handleIsExactPositionChange = useCallback(
    (value: boolean) => {
      if (!organisation) return
      updateOrganisation(organisation.id, { isExactPosition: value })
    },
    [organisation, updateOrganisation],
  )

  const handleParentChange = useCallback(
    (parentId: string | null) => {
      if (!organisation) return
      const patch: Partial<Organisation> = { parentId }
      if (parentId == null && organisation.positionMode === "parent") {
        patch.positionMode = "none"
      }
      updateOrganisation(organisation.id, patch)
    },
    [organisation, updateOrganisation],
  )

  const handleSelectOsmRelation = useCallback(
    (relationId: number) => {
      if (!organisation) return
      updateOrganisation(organisation.id, { osmRelationId: relationId })
      setFindDialogOpen(false)
    },
    [organisation, updateOrganisation],
  )

  const handleAddSource = useCallback(() => {
    if (!organisation) return
    const value = newSource.trim()
    if (value === "") return
    const next = organisation.sources ? `${organisation.sources}${SOURCES_DELIMITER}${value}` : value
    updateOrganisation(organisation.id, { sources: next })
    setNewSource("")
  }, [organisation, newSource, updateOrganisation])

  const handleRemoveSource = useCallback(
    (index: number) => {
      if (!organisation) return
      const updated = sources.filter((_, i) => i !== index)
      const next = updated.join(SOURCES_DELIMITER)
      updateOrganisation(organisation.id, { sources: next === "" ? null : next })
    },
    [organisation, updateOrganisation, sources],
  )

  return {
    organisation,
    linkedGeometries,
    parentName,
    typeValue,
    positionModeValue,
    isExactPositionValue,
    parentOptions,
    firstPoint,
    sourceEditor: {
      sources,
      draft: newSource,
      setDraft: setNewSource,
      add: handleAddSource,
      remove: handleRemoveSource,
    },
    findDialogOpen,
    setFindDialogOpen,
    handleNameChange,
    handleTypeChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
  }
}

import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import type { Organisation } from "@/types/organisation.types"
import { OrganisationNode } from "./OrganisationNode"
import { useProjectStore } from "@/store/useProjectStore"
import { useShallow } from "zustand/shallow"

const nodeTypes = { organisation: OrganisationNode }

const H_SPACING = 110
const V_SPACING = 130

export function OrganisationTreeView() {
  const { organisations, selectedOrganisationId } = useProjectStore(
    useShallow((s) => ({ organisations: s.organisations, selectedOrganisationId: s.selectedOrganisationId }))
  )

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = []
    const edgeList: Edge[] = []
    const orgsById = new Map(organisations.map((o) => [o.id, o]))

    const childrenByParent = new Map<string | null, Organisation[]>()
    for (const org of organisations) {
      const parentKey = (org.parentId ?? null) as string | null
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, [])
      childrenByParent.get(parentKey)!.push(org)
    }

    const roots = childrenByParent.get(null) ?? []
    const xIndexById = new Map<string, number>()
    let currentXIndex = 0

    function layoutOrg(org: Organisation): number {
      const children = childrenByParent.get(org.id) ?? []
      const childXIndexes: number[] = []
      for (const child of children) childXIndexes.push(layoutOrg(child))

      let xIndex: number
      if (childXIndexes.length === 0) {
        xIndex = currentXIndex++
      } else {
        xIndex = (childXIndexes[0] + childXIndexes[childXIndexes.length - 1]) / 2
      }
      xIndexById.set(org.id, xIndex)
      return xIndex
    }

    for (const root of roots) layoutOrg(root)

    const depthById = new Map<string, number>()
    function getDepth(org: Organisation): number {
      const cached = depthById.get(org.id)
      if (cached != null) return cached
      if (org.parentId == null) { depthById.set(org.id, 0); return 0 }
      const parent = orgsById.get(org.parentId)
      if (!parent) { depthById.set(org.id, 0); return 0 }
      const depth = getDepth(parent) + 1
      depthById.set(org.id, depth)
      return depth
    }

    for (const org of organisations) {
      const nodeId = String(org.id)
      const xIndex = xIndexById.get(org.id)
      if (xIndex == null) continue

      nodeList.push({
        id: nodeId,
        type: "organisation",
        className: "tree-symbol-node",
        position: { x: xIndex * H_SPACING, y: getDepth(org) * V_SPACING },
        data: { label: org.name, organisation: org },
        selected: nodeId === selectedOrganisationId,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })

      if (org.parentId != null) {
        edgeList.push({
          id: `e-${org.parentId}-${nodeId}`,
          source: String(org.parentId),
          target: nodeId,
        })
      }
    }

    return { nodes: nodeList, edges: edgeList }
  }, [organisations, selectedOrganisationId])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const s = useProjectStore.getState()
    s.setSelectedOrganisationId(node.id)
    s.setSelectedEntityId(null)
    s.setSelectedOsmObject(null)
  }, [])

  const handlePaneClick = useCallback(() => {
    const s = useProjectStore.getState()
    s.setSelectedOrganisationId(null)
    s.setSelectedOsmObject(null)
  }, [])

  if (organisations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No industrial entities yet.
        <br />
        Draw a geometry and choose &quot;+ Industrial entity&quot;.
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep" }}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  )
}

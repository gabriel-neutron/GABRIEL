import { useCallback, useMemo } from "react"
import ReactFlow, { Background, type Edge, type Node, Position } from "reactflow"
import { OrganisationNode } from "./OrganisationNode"
import { useProjectStore } from "@/store/useProjectStore"
import { useShallow } from "zustand/shallow"
import { buildOrbat } from "@/core/entity/hierarchy"
import { computeTreeXIndex } from "@/modules/orbat/services/treeLayout"

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

    const orbat = buildOrbat(organisations)
    const xIndexById = computeTreeXIndex(orbat)

    for (const org of organisations) {
      const nodeId = String(org.id)
      const xIndex = xIndexById.get(org.id)
      if (xIndex == null) continue

      nodeList.push({
        id: nodeId,
        type: "organisation",
        className: "tree-symbol-node",
        position: { x: xIndex * H_SPACING, y: orbat.depthOf(org.id) * V_SPACING },
        data: { label: org.name, organisation: org },
        selected: nodeId === selectedOrganisationId,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })

      if (org.parentId != null && xIndexById.has(org.parentId)) {
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

export type Point = { x: number; y: number }

/**
 * A tree laid out on concentric rings: roots at the centre, each generation one ring
 * further out, and every subtree given an angular wedge proportional to how many leaves
 * it holds.
 *
 * Why a layout at all, and why this one. Sigma renders whatever coordinates it is handed,
 * and the only coordinates in this repo before now were `Math.random()` — a cloud, in
 * which no arrangement of nodes means anything. The corpus this has to draw is 1,012
 * edges of which 999 are `subordinate_to` minted from a legacy `parent_id` column, so it
 * is overwhelmingly a tree, and a tree laid out radially is legible at a thousand nodes
 * where a force simulation is a blob. The payoff is what the non-hierarchy edges then
 * look like: a `supplies` or `owned_by` edge is a chord cutting across the rings, visible
 * precisely because everything else is orderly.
 *
 * Leaf-proportional wedges are the part that matters. Splitting each ring evenly would
 * allot a 900-unit army and a lone battalion the same slice, and the army would be an
 * unreadable smear while most of the circle stood empty.
 *
 * Pure and deterministic — no clock, no randomness, no DOM. Positions are unitless;
 * Sigma normalises to its own viewport.
 */

const RING_SPACING = 100

type Tree = {
  roots: string[]
  childrenOf: Map<string, string[]>
  leafCount: Map<string, number>
}

/**
 * A parent outside `nodeIds` is not a parent. A filtered graph routinely names one — the
 * hierarchy is computed over the whole project so positions hold still while an analyst
 * changes the edge filters — and reading it as a depth would orbit a child around a node
 * that is not being drawn.
 */
function buildTree(nodeIds: readonly string[], parentOf: ReadonlyMap<string, string>): Tree {
  const present = new Set(nodeIds)
  const roots: string[] = []
  const childrenOf = new Map<string, string[]>()

  for (const id of nodeIds) {
    const parent = parentOf.get(id)
    if (parent == null || !present.has(parent) || parent === id) {
      roots.push(id)
      continue
    }
    const siblings = childrenOf.get(parent)
    if (siblings == null) childrenOf.set(parent, [id])
    else siblings.push(id)
  }

  // A cycle leaves every member claiming a parent, so none of them is a root and the whole
  // component would go unplaced. `validateRelationships` reports cycles rather than
  // forbidding them, and no one has proved the 1,012-edge corpus acyclic, so the layout
  // adopts the unreached remainder as roots instead of dropping it off the canvas.
  const reachable = new Set<string>()
  const pending = [...roots]
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const child of childrenOf.get(id) ?? []) pending.push(child)
  }
  for (const id of nodeIds) {
    if (!reachable.has(id)) roots.push(id)
  }

  return { roots, childrenOf, leafCount: countLeaves(nodeIds, roots, childrenOf, reachable) }
}

/**
 * Leaves under each node, counted bottom-up over an explicit stack rather than by
 * recursion: the deepest chain in the real project is unbounded by anything but the data,
 * and a stack overflow in a view is a worse failure than a slow one.
 */
function countLeaves(
  nodeIds: readonly string[],
  roots: readonly string[],
  childrenOf: ReadonlyMap<string, string[]>,
  reachable: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>()
  const order: string[] = []
  const pending = [...roots]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
    for (const child of childrenOf.get(id) ?? []) pending.push(child)
  }

  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i]
    const children = childrenOf.get(id) ?? []
    if (children.length === 0) {
      counts.set(id, 1)
      continue
    }
    let total = 0
    for (const child of children) total += counts.get(child) ?? 1
    counts.set(id, total)
  }

  for (const id of nodeIds) {
    if (!reachable.has(id) && !counts.has(id)) counts.set(id, 1)
  }
  return counts
}

/**
 * `nodeIds` is the whole output domain: every id in it gets a position and no id outside
 * it does, whatever `parentOf` says. `parentOf` is child id -> parent id, which is exactly
 * what `hierarchyIndex(...).parents()` returns.
 */
export function radialLayout(
  nodeIds: readonly string[],
  parentOf: ReadonlyMap<string, string>,
): Map<string, Point> {
  const positions = new Map<string, Point>()
  if (nodeIds.length === 0) return positions

  const tree = buildTree(nodeIds, parentOf)

  // A single root earns the centre; several would sit on top of each other there, so they
  // share the first ring instead.
  if (tree.roots.length === 1) {
    positions.set(tree.roots[0], { x: 0, y: 0 })
    placeChildren(tree, tree.roots[0], 1, 0, 2 * Math.PI, positions)
    return positions
  }

  placeSiblings(tree, tree.roots, 1, 0, 2 * Math.PI, positions)
  return positions
}

function placeChildren(
  tree: Tree,
  parentId: string,
  depth: number,
  from: number,
  to: number,
  positions: Map<string, Point>,
): void {
  placeSiblings(tree, tree.childrenOf.get(parentId) ?? [], depth, from, to, positions)
}

/**
 * Divides `[from, to)` among `siblings` by leaf count and places each at its wedge's
 * midpoint, then recurses into the wedge. Iterative over an explicit stack for the same
 * reason `countLeaves` is.
 */
function placeSiblings(
  tree: Tree,
  siblings: readonly string[],
  depth: number,
  from: number,
  to: number,
  positions: Map<string, Point>,
): void {
  type Frame = { ids: readonly string[]; depth: number; from: number; to: number }
  const stack: Frame[] = [{ ids: siblings, depth, from, to }]

  while (stack.length > 0) {
    const frame = stack.pop() as Frame
    if (frame.ids.length === 0) continue

    let totalLeaves = 0
    for (const id of frame.ids) totalLeaves += tree.leafCount.get(id) ?? 1
    const span = frame.to - frame.from
    let cursor = frame.from

    for (const id of frame.ids) {
      const share = ((tree.leafCount.get(id) ?? 1) / totalLeaves) * span
      // Already placed: a cycle's members are each other's children AND adopted roots, so
      // descending into them a second time is what would spin forever. First placement
      // wins, which for an adopted root is its ring-1 position.
      if (positions.has(id)) {
        cursor += share
        continue
      }
      const angle = cursor + share / 2
      const radius = frame.depth * RING_SPACING
      positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
      const children = tree.childrenOf.get(id) ?? []
      if (children.length > 0) {
        stack.push({ ids: children, depth: frame.depth + 1, from: cursor, to: cursor + share })
      }
      cursor += share
    }
  }
}

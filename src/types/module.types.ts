import type { ReactNode } from "react"

/**
 * What's currently selected, generalized beyond `useProjectStore`'s entity selection
 * (ADR 0007). `kind` is the discriminant a module's `detailRenderer` is keyed by
 * ("unit"/"corporate" for orbat entities, "osm" for osm module objects, etc.).
 */
export type SelectedRef = {
  kind: string
  id: string
  /**
   * Owning-module-only payload a `detailRenderer` can read off the selection store
   * directly (its function signature only receives `id`) — e.g. osm's cached
   * GeoJSON feature, kept as a perf shortcut for `OsmObjectInspector`.
   */
  meta?: unknown
}

export type ModuleCommandContext = {
  selectedRef: SelectedRef | null
  readOnly: boolean
}

export type ModuleView = {
  id: string
  label: string
  content: ReactNode
}

export type ModuleLeftPanel = {
  id: string
  label: string
  content: ReactNode
}

export type ModuleCommand = {
  id: string
  label: string
  run: (ctx: ModuleCommandContext) => void
  when?: (ctx: ModuleCommandContext) => boolean
}

/**
 * A module's static contribution to the shell (ADR 0007). Composed once into a plain
 * array by `shell/moduleRegistry.ts` — no dynamic `registerModule()`.
 */
export type ModuleManifest = {
  /** Whole standalone top-level views, alongside the fixed core "map" view. */
  views?: ModuleView[]
  /**
   * Keyed by the `selectedRef.kind` this module owns. ADR 0007 describes this as a
   * single `(id: string) => ReactNode` function "keyed by" kind — a bare function
   * can't be routed to the right module without the shell naming it, which is the
   * exact branching this manifest exists to remove. A small per-kind map achieves
   * the same "keyed by kind" intent while staying shell-generic: the shell merges
   * every module's map and looks up `selectedRef.kind`, never naming a module.
   */
  detailRenderer?: Partial<Record<string, (id: string) => ReactNode>>
  /** Left-sidebar tabs, alongside the fixed core "Layers" panel. */
  leftPanels?: ModuleLeftPanel[]
  /** Rendered inside the header "..." dropdown, additive to its fixed settings/chrome entries. */
  headerContribution?: ReactNode
  /**
   * Always-mounted, portal-based UI (dialogs, drawers) rendered once by `MainLayout`,
   * independent of any trigger's mount lifetime. A module whose `headerContribution`
   * (or a `command`) opens a Dialog must put the Dialog here, not bundle it with the
   * trigger — a trigger living inside the header "..." dropdown unmounts when that
   * dropdown closes, taking a bundled Dialog with it, so a command-palette `run()`
   * flipping the shared open-state would be a silent no-op (Gate E4 bug, 2026-07-13).
   */
  overlays?: ReactNode[]
  /** Rendered inside `core/map/MapView`'s `<MapContainer>`, in registry order. */
  mapLayers?: ReactNode[]
  /** Fed into the command palette (Ctrl/Cmd+K). */
  commands?: ModuleCommand[]
}

import { createContext, useContext } from "react"

/**
 * Page-scoped context a manifest's `detailRenderer`/`leftPanels`/`headerContribution`
 * can't receive as props (ADR 0007's manifest fields are static, composed once — see
 * `moduleRegistry.ts`). `MainLayout` already receives `readOnly` and the enrichment
 * overlay as page props; it provides them here instead of threading them through the
 * generic module-composition path, which would reintroduce per-module wiring.
 */
export type ModuleRenderContext = {
  readOnly: boolean
  enrichedOverlay: Record<string, unknown>
}

const defaultContext: ModuleRenderContext = { readOnly: false, enrichedOverlay: {} }

export const ModuleContext = createContext<ModuleRenderContext>(defaultContext)

export function useModuleContext(): ModuleRenderContext {
  return useContext(ModuleContext)
}

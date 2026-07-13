import type { ReactNode } from "react"
import { orbatModule } from "@/modules/orbat/module"
import { osmModule } from "@/modules/osm/module"
import type { ModuleManifest } from "@/types/module.types"

/**
 * Static composition, no dynamic `registerModule()` (ADR 0007) — this is a
 * single-bundle, local-first app; nothing loads modules independently or out of
 * order.
 */
export const modules: ModuleManifest[] = [orbatModule, osmModule]

export function detailRenderers(): Partial<Record<string, (id: string) => ReactNode>> {
  return Object.assign({}, ...modules.map((m) => m.detailRenderer ?? {}))
}

import { SidecarStatusIndicator } from "@/modules/telegram/ui/SidecarStatusIndicator"
import { TelegramGraphView } from "@/modules/telegram/ui/TelegramGraphView"
import type { ModuleManifest } from "@/types/module.types"

/**
 * Telegram OSINT module's shell contribution (ADR 0007, docs/TELEGRAM_OSINT_PRD.md).
 * Scoped to what's actually backed by sidecar endpoints today: a read-only graph view
 * (FR-7) against `/graph`, pure DB/SQL, no live Telegram call. Crawl start/pause/resume
 * controls and `detailRenderer` for `telegram-channel` (channel detail with real
 * collected metadata) are NOT wired yet: they depend on collector.py/crawler.py, still
 * gated on Phase 1's validation exit criteria (docs/timelines/TELEGRAM_TIMELINE.md) — do
 * not add UI for endpoints that don't exist.
 */
export const telegramModule: ModuleManifest = {
  headerContribution: <SidecarStatusIndicator />,
  views: [{ id: "telegram-graph", label: "Telegram Graph", content: <TelegramGraphView />, hideSidebar: true }],
}

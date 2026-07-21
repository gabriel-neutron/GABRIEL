import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { SidecarHealth } from "@/modules/telegram/services/sidecar.service"

export type SidecarConnectionStatus = "checking" | "reachable" | "unreachable"

/**
 * Telegram module state (ADR 0007 — separate from useProjectStore since the sidecar's
 * graph/crawl state is independent of the .gpkg entity model). Phase 2 only needs
 * sidecar connection status; graph data, selected channel, and crawl state land in
 * Phase 6.
 */
export interface TelegramState {
  connectionStatus: SidecarConnectionStatus
  health: SidecarHealth | null
}

export interface TelegramActions {
  setHealth(health: SidecarHealth): void
  setUnreachable(): void
  setChecking(): void
}

export const useTelegramStore = create<TelegramState & TelegramActions>()(
  devtools(
    (set) => ({
      connectionStatus: "checking",
      health: null,

      setHealth(health) {
        set({ connectionStatus: "reachable", health }, false, "setHealth")
      },
      setUnreachable() {
        set({ connectionStatus: "unreachable", health: null }, false, "setUnreachable")
      },
      setChecking() {
        set({ connectionStatus: "checking" }, false, "setChecking")
      },
    }),
    { name: "GabrielTelegramStore", enabled: import.meta.env.DEV },
  ),
)

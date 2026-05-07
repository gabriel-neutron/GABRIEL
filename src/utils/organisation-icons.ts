import L from "leaflet"
import type { OrganisationType } from "@/types/organisation.types"

type SvgAttr = Record<string, string | number>
type SvgNode = [string, SvgAttr]

// Lucide icon nodes (24x24 viewBox) per OrganisationType.
// Source: lucide-react v0.568.0 — ISC license.
const ICON_NODES: Record<OrganisationType, SvgNode[]> = {
  holding: [
    ["path", { d: "M10 12h4" }],
    ["path", { d: "M10 8h4" }],
    ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3" }],
    ["path", { d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" }],
    ["path", { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" }],
  ],
  company: [
    ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }],
    ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2" }],
  ],
  factory: [
    ["path", { d: "M12 16h.01" }],
    ["path", { d: "M16 16h.01" }],
    ["path", { d: "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" }],
  ],
  design_bureau: [
    ["path", { d: "M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" }],
    ["path", { d: "m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" }],
    ["path", { d: "m2.3 2.3 7.286 7.286" }],
    ["circle", { cx: "11", cy: "11", r: "2" }],
  ],
  research_institute: [
    ["path", { d: "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" }],
    ["path", { d: "M6.453 15h11.094" }],
    ["path", { d: "M8.5 2h7" }],
  ],
  export_agency: [
    ["path", { d: "M12 10.189V14" }],
    ["path", { d: "M12 2v3" }],
    ["path", { d: "M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" }],
    ["path", { d: "M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" }],
    ["path", { d: "M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" }],
  ],
  state_corporation: [
    ["path", { d: "M10 18v-7" }],
    ["path", { d: "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z" }],
    ["path", { d: "M14 18v-7" }],
    ["path", { d: "M18 18v-7" }],
    ["path", { d: "M3 22h18" }],
    ["path", { d: "M6 18v-7" }],
  ],
  government_agency: [
    ["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }],
  ],
  logistics_hub: [
    ["path", { d: "M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" }],
    ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z" }],
    ["path", { d: "M6 13h12" }],
    ["path", { d: "M6 17h12" }],
  ],
  test_facility: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["line", { x1: "22", x2: "18", y1: "12", y2: "12" }],
    ["line", { x1: "6", x2: "2", y1: "12", y2: "12" }],
    ["line", { x1: "12", x2: "12", y1: "6", y2: "2" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "18" }],
  ],
  other: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
  ],
}

function nodesToSvgElements(nodes: SvgNode[]): string {
  return nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("")
}

function makeOrganisationSvg(type: OrganisationType, markerFill: string, markerStroke: string): string {
  const nodes = ICON_NODES[type] ?? ICON_NODES.other
  const iconSvg = nodesToSvgElements(nodes)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<circle cx="16" cy="16" r="16" fill="${markerFill}"/>` +
    `<g transform="translate(8,8) scale(0.6667)" fill="none" stroke="${markerStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    iconSvg +
    `</g>` +
    `</svg>`
  )
}

const iconCache = new Map<string, L.Icon>()

export function makeOrganisationIcon(type: OrganisationType): L.Icon {
  const style = typeof window === "undefined" ? null : getComputedStyle(document.documentElement)
  const markerFill = style?.getPropertyValue("--primary").trim() || "#f59e0b"
  const markerStroke = style?.getPropertyValue("--primary-foreground").trim() || "#ffffff"
  const cacheKey = `${type}|${markerFill}|${markerStroke}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached
  const svg = makeOrganisationSvg(type, markerFill, markerStroke)
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const icon = L.icon({ iconUrl: uri, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] })
  iconCache.set(cacheKey, icon)
  return icon
}

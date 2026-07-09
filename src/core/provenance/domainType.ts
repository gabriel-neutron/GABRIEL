import type { SourceDomainType } from "@/types/enrichment.types"

/**
 * Relocated from `modules/enrichment/services/validators.ts` (ADR 0006, E2): `Source.domainType`
 * needs this classification, and `core/` must not depend on a module's service layer.
 */
export function getDomainTypeFromUrl(url: string): SourceDomainType {
  let hostname = ""
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return "web"
  }

  if (hostname.endsWith("wikipedia.org")) return "wikipedia"
  // Match government/military by DNS *label*, not just a `.gov`/`.mil` TLD suffix, so
  // country-code domains classify correctly too: gov.uk, gov.ua, gouv.fr, mod.gov.ua,
  // army.mil, mil.ru all contain a `gov`/`gouv`/`mil` label.
  const labels = hostname.split(".")
  if (labels.includes("gov") || labels.includes("gouv") || labels.includes("mil")) return "official"
  if (
    hostname.endsWith("bellingcat.com") ||
    hostname.endsWith("oryxspioenkop.com") ||
    hostname.endsWith("uawardata.com")
  ) {
    return "osint"
  }
  if (hostname.endsWith("vk.com") || hostname.includes("telegram")) return "social"
  if (hostname.includes("reddit.com") || hostname.includes("forum")) return "forum"
  if (
    hostname.endsWith("bbc.com") ||
    hostname.endsWith("rferl.org") ||
    hostname.endsWith("meduza.io")
  ) {
    return "news"
  }
  return "web"
}

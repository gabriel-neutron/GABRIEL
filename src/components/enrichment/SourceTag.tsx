import type { EnrichmentSource } from "@/types/enrichment.types"

const MS_PER_DAY = 86_400_000
const STALE_DAYS = 365

type SourceTagProps = {
  source: EnrichmentSource
}

function isPublishedStale(iso: string): boolean {
  const t = Date.parse(iso.trim())
  if (Number.isNaN(t)) return false
  return Date.now() - t > STALE_DAYS * MS_PER_DAY
}

function formatPublished(iso: string): string {
  const t = Date.parse(iso.trim())
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString()
}

export function SourceTag({ source }: SourceTagProps) {
  const title = source.title.trim()
  let sourceName = title
  if (sourceName === "") {
    try {
      sourceName = new URL(source.url).hostname.replace(/^www\./, "")
    } catch {
      sourceName = source.url
    }
  }

  const published = source.publishedAt?.trim()
  const stale = published != null && published.length > 0 && isPublishedStale(published)

  return (
    <span className="inline-flex max-w-full flex-col gap-0.5">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Open source: ${title || sourceName}`}
        className="inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        title={source.snippet}
      >
        <span className="truncate">{sourceName}</span>
      </a>
      {published != null && published.length > 0 && (
        <span className="flex flex-wrap items-center gap-1 pl-0.5 text-[10px] text-muted-foreground">
          <span>{formatPublished(published)}</span>
          {stale && (
            <span className="rounded bg-amber-500/20 px-1 py-0 font-medium text-amber-800 dark:text-amber-200">
              Stale
            </span>
          )}
        </span>
      )}
    </span>
  )
}

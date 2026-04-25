import type { EnrichmentSource } from "@/types/enrichment.types"

type SourceTagProps = {
  source: EnrichmentSource
}

export function SourceTag({ source }: SourceTagProps) {
  let sourceName = source.title.trim()
  if (sourceName === "") {
    try {
      sourceName = new URL(source.url).hostname.replace(/^www\./, "")
    } catch {
      sourceName = source.url
    }
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`Open source: ${source.title}`}
      className="inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      title={source.snippet}
    >
      <span className="truncate">{sourceName}</span>
    </a>
  )
}


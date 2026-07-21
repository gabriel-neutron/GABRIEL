import { useState } from "react"
import { Input } from "@/ui/input"
import { searchGraph, type SearchResult } from "@/modules/telegram/services/sidecar.service"

/** FR-7 search. Backend (`GET /search?q=`) is pure SQL over channels + extracted
 * entities — works against seed-only data, no Telegram dependency. */
export function GraphSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleChange(value: string) {
    setQuery(value)
    if (!value.trim()) {
      setResults([])
      setError(null)
      return
    }
    try {
      setResults(await searchGraph(value))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <Input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search channels, units, MUNs…"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="text-sm">
              <span className="text-muted-foreground">[{r.kind}]</span> {r.label}
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No matches.</p>
      )}
    </div>
  )
}

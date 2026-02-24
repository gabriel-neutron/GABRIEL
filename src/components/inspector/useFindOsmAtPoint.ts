import { useEffect, useState } from "react"
import { findOsmElementsAtPoint, type OsmElementCandidate } from "@/services/overpass.service"

export type { OsmElementCandidate }

export function useFindOsmAtPoint(open: boolean, lat: number, lng: number) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<OsmElementCandidate[]>([])

  useEffect(() => {
    if (!open) {
      setError(null)
      setCandidates([])
      return
    }
    const controller = new AbortController()
    setError(null)
    setCandidates([])
    setLoading(true)
    findOsmElementsAtPoint(lat, lng, { radiusMeters: 100, signal: controller.signal })
      .then(setCandidates)
      .catch((e) => {
        if (e?.name === "AbortError") return
        setError(e instanceof Error ? e.message : "Search failed")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [open, lat, lng])

  return { loading, error, candidates }
}

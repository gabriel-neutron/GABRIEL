export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)"
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

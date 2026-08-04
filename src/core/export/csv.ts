/**
 * RFC 4180 CSV. Written here rather than taken as a dependency because the whole of what
 * this project needs is one escaping rule, and that rule is the only place a CSV writer can
 * go wrong.
 *
 * The rule matters more than it looks: this dataset's unit names are full of commas,
 * parentheses and quotation marks ("Motorized Rifle Battalion (Attached / Alt.)"), so an
 * unescaped writer would silently shift every column right on exactly the rows a reuser is
 * most likely to be looking at.
 */

function escapeField(value: unknown): string {
  if (value == null) return ""
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return '"' + text.split('"').join('""') + '"'
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [headers.map(escapeField).join(",")]
  for (const row of rows) lines.push(row.map(escapeField).join(","))
  // Trailing newline: a file whose last line has no terminator makes `cat`ting two exports
  // together silently join two rows.
  return lines.join("\n") + "\n"
}

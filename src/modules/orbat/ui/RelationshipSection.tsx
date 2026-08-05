import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { edgeTypeLabel, humaniseToken } from "@/core/relationship/edgeForm"
import { useRelationshipEditor, type EdgeRow, type RelationshipEditorState } from "@/modules/orbat/hooks/useRelationshipEditor"
import { RelationshipDraftForm } from "./RelationshipDraftForm"

/**
 * The typed-relationship editor, as a section of the entity inspector.
 *
 * Until this section, every relationship write in Gabriel went through the parent picker, so
 * eleven of the twelve record-tier types were modelled, validated, persisted, exported and
 * documented while being unreachable: the PRD's "I can catalogue the nodes of the backbone; I
 * cannot record the backbone" was literally true of the interface. This is what makes it false.
 *
 * Edges live in the session until the analyst saves the project — `public/project.gpkg` has no
 * `relationships` table yet, and writing one is the owner's call, not this section's.
 */

function metadataSummary(row: EdgeRow): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(row.metadata)) {
    if (value === undefined || value === null) continue
    parts.push(humaniseToken(key) + ": " + String(value))
  }
  return parts.join(", ")
}

function RelationshipRow({
  row,
  readOnly,
  editor,
}: {
  row: EdgeRow
  readOnly: boolean
  editor: RelationshipEditorState
}) {
  const label = edgeTypeLabel(row.type)
  const isAssessment = row.definition?.tier === "assessment"
  const metadata = metadataSummary(row)

  return (
    <li className="rounded border p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* The sentence the type is named for, read from whichever end is being inspected. */}
          <p className="truncate">
            {row.direction === "out" ? (
              <>
                <span className="text-muted-foreground">this </span>
                <span className="font-medium">{label}</span> {row.otherName}
              </>
            ) : (
              <>
                {row.otherName} <span className="font-medium">{label}</span>
                <span className="text-muted-foreground"> this</span>
              </>
            )}
          </p>
          <p className="text-muted-foreground">
            {isAssessment && <span className="mr-1 font-medium">ASSESSMENT</span>}
            {row.startDate != null && <span>from {row.startDate} </span>}
            {row.endDate != null ? <span>ended {row.endDate}</span> : <span>active</span>}
            {metadata !== "" && <span> — {metadata}</span>}
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-destructive"
            onClick={() => editor.remove(row.id)}
          >
            Delete
          </Button>
        )}
      </div>
      {!readOnly && (
        <label className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          End date
          <Input
            type="date"
            className="h-6 w-36 text-[11px]"
            value={row.endDate ?? ""}
            // End-dating rather than deleting is the difference between "this stopped" and "this
            // was never said" — for a documentary record those are not the same statement.
            onChange={(e) => editor.endDate(row.id, e.target.value === "" ? null : e.target.value)}
          />
        </label>
      )}
    </li>
  )
}

export function RelationshipSection({ readOnly = false }: { readOnly?: boolean }) {
  const editor = useRelationshipEditor()
  if (editor.entity == null) return null

  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium text-muted-foreground">Relationships</div>
        <p className="text-[11px] text-muted-foreground">
          Typed, directed records. Kept in this session until the project is saved.
        </p>
      </div>

      {editor.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing recorded about this entity.</p>
      ) : (
        <ul className="space-y-1">
          {editor.rows.map((row) => (
            <RelationshipRow key={row.id} row={row} readOnly={readOnly} editor={editor} />
          ))}
        </ul>
      )}

      {!readOnly && <RelationshipDraftForm editor={editor} />}
    </div>
  )
}

import { Button } from "@/ui/button"
import { Field, FieldLabel } from "@/ui/field"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { edgeTypeLabel, humaniseToken, refusalMessages } from "@/core/relationship/edgeForm"
import type { RelationshipType } from "@/core/relationship/relationship"
import { ASSESSMENT_TIER_TYPES, RECORD_TIER_TYPES } from "@/core/relationship/vocabulary"
import type { RelationshipEditorState } from "@/modules/orbat/hooks/useRelationshipEditor"

/**
 * The authoring form. Every field it renders is derived from the type the analyst picked —
 * `EDGE_TYPES` declares the endpoint labels, the required date and the metadata keys, and this
 * reads them rather than restating them.
 *
 * `publicDefinition` is shown verbatim, never paraphrased: that string ships in the CC-BY dataset,
 * so what the analyst reads while recording an edge is exactly what a reuser reads about it later.
 */
export function RelationshipDraftForm({ editor }: { editor: RelationshipEditorState }) {
  const { draft, definition, metadataFields, targets, violations } = editor
  const startRequired = definition?.dateRequired === "start"

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2">
      <Field>
        <FieldLabel className="text-xs">Relationship</FieldLabel>
        <Select value={draft.type} onValueChange={(v) => editor.setType(v as RelationshipType)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Record</SelectLabel>
              {RECORD_TIER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{edgeTypeLabel(type)}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Assessment</SelectLabel>
              {ASSESSMENT_TIER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{edgeTypeLabel(type)}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {definition != null && (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{definition.publicDefinition}</p>
        )}
      </Field>

      <Field>
        <FieldLabel className="text-xs">
          {definition != null ? "Target — " + definition.toLabel : "Target"}
        </FieldLabel>
        <Select value={draft.toId} onValueChange={editor.setToId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Pick the other end" />
          </SelectTrigger>
          <SelectContent className="!max-h-80" position="popper">
            {targets.map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {target.name + " (" + target.kind + ")"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-xs">{startRequired ? "Start date (required)" : "Start date"}</FieldLabel>
          <Input
            type="date"
            className="h-8 text-sm"
            value={draft.startDate}
            onChange={(e) => editor.setStartDate(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">End date</FieldLabel>
          <Input
            type="date"
            className="h-8 text-sm"
            value={draft.endDate}
            onChange={(e) => editor.setEndDate(e.target.value)}
          />
        </Field>
      </div>

      {metadataFields.map((field) => (
        <Field key={field.key}>
          <FieldLabel className="text-xs">{humaniseToken(field.key)}</FieldLabel>
          {field.kind === "enum" ? (
            <Select
              value={draft.metadata[field.key] ?? ""}
              onValueChange={(v) => editor.setMetadata(field.key, v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Not recorded" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option}>{humaniseToken(option)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              min={field.min}
              max={field.max}
              className="h-8 text-sm"
              placeholder="Not recorded"
              value={draft.metadata[field.key] ?? ""}
              onChange={(e) => editor.setMetadata(field.key, e.target.value)}
            />
          )}
        </Field>
      ))}

      {violations.length > 0 && (
        // The validator's own words, not a rewrite of them: it is the only thing in the app that
        // knows why an edge was refused, and an analyst told "invalid" cannot fix anything.
        <ul className="space-y-1 rounded border border-destructive/50 p-2 text-[11px] text-destructive">
          {refusalMessages(violations).map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={!editor.canCommit}
        onClick={editor.commit}
      >
        Record relationship
      </Button>
    </div>
  )
}

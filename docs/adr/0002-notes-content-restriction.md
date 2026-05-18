# Notes field restricted to organisational changes and epistemic caveats

The `notes` field on a MapEntity may only contain: (1) recent organisational changes — reform, rename, re-subordination — and (2) epistemic caveats flagging uncertainty or source contradictions. Battle history, operational movements, and any information already present in structured fields are explicitly excluded.

The synthesis prompt enforces this: "Do not write notes that restate information already in the entity's structured properties. Only write a note when you found a recent organisational change (reform, rename, re-subordination) or an epistemic caveat (uncertainty, unconfirmed identity, conflicting sources). If neither applies, return null for notes."

## Why

Without this constraint the model defaults to serialising known entity properties as prose ("Unit X is located in Y under command of Z"), which provides zero analytical value and misleads analysts into thinking they're reading novel intelligence.

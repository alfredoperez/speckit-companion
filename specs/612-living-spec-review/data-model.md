# Data Model: Reviewing a living spec

## Requirement link

One entry in a card's Leans on or Leaned on by list. It goes on `LivingOverview.requirements[]` in `src/protocol/viewer.ts`.

| Field | Type | Rule |
|---|---|---|
| `capability` | string | The capability named by the link, or the aligning requirement's capability. |
| `heading` | string | Exact heading text. Matching is exact, never case-folded. |
| `raw` | string | The link as written, `capability#heading`. Shown when the link is broken. |
| `broken` | boolean | True when the capability is not registered, its spec is missing, or no requirement has that heading. Leaned on by entries are never broken. |
| `specPath` | string, optional | Workspace-relative spec path. Present only when not broken, and used to open it. |

The overview requirement becomes `{ heading, adopted, leansOn: RequirementLink[], leanedOnBy: RequirementLink[] }`.

- `leansOn` keeps the order of the aligns marker. A link into the same capability is listed like any other.
- `leanedOnBy` excludes the requirement's own capability, so a self-link appears once, under Leans on.
- Two requirements with the same heading get the same lists.

## Header meta: new requirements

`LivingHeaderMeta.newRequirements?: string[]` holds the working-copy headings absent from `main`'s copy of the same file.

- Absent when `git show main:<path>` fails for any reason, including a file that `main` does not have.
- An empty list means nothing is new. The header shows "N new" only when N ≥ 1.
- Never written to disk.

## Pending undo

Held on the panel state in `specViewerProvider.ts`, at most one per panel.

| Field | Type | Rule |
|---|---|---|
| `token` | string | Fresh per action. An undo message with a stale token is ignored. |
| `kind` | `'approve' \| 'remove'` | Decides whether settling writes a removal record. |
| `filePath` | string | Absolute path of the file written. |
| `before` | string | File text before the action, restored byte for byte. |
| `after` | string | File text the action wrote, compared on Undo. |
| `capability` | string | Needed for the removal record. |
| `heading` | string, optional | Present for `remove`. |
| `expiresAt` | number | Epoch ms, action time + 5000. |
| `timer` | timeout handle | Settles the undo when it fires. |

What `NavState.livingUndo` sends the webview: `{ token, kind, expiresAt }`. The state builder sends it only while `expiresAt` is still ahead.

**State transitions**

```text
(none) --approve/remove written--> pending
pending --Undo, disk == after--> (none), before written, no record
pending --Undo, disk != after--> (none), nothing written, warning shown, remove records
pending --timer / newer action / panel closed / re-anchored--> (none), remove records
```

## Removal record

One `history[]` entry in `<spec file's directory>/.spec-context.json`. It is append-only, and the file is created when absent.

```json
{ "kind": "requirement-removed", "capability": "spec-viewer-living", "requirement": "<exact heading>", "at": "2026-09-17T17:40:00.000Z", "by": "user" }
```

- `capability` is always set, because colocated capabilities share a directory.
- Unknown top-level fields and existing entries are preserved.
- No feature-spec defaults are added.
- Readers: `removed_requirements(spec_path, capability)` in `resolve-spec-paths.py` returns the set of headings recorded for that capability.

# UI Contract: the inline comment annotation

The identifiers tests and stories code against. Anything the spec pinned verbatim is reproduced here exactly.

## Component

`InlineComment` (`webview/src/spec-viewer/components/InlineComment.tsx`)

| Prop | Type | Notes |
|---|---|---|
| `refinement` | `Refinement` | Carries `status`. |
| `mode` | `'line' \| 'row'` | Unchanged — `row` wraps the annotation in a `<tr>`/`<td>` for scenario tables. |
| `onDelete` | `(refId: string) => void` | Unchanged. |
| `onEdit` | `(refId: string) => void` | New. |
| `onRefine` | `(refId: string) => void` | New. Dispatches the document's pending batch. |
| `readOnly` | `boolean` (optional) | New. Suppresses the action row on a completed/archived spec. |

## DOM contract

| Class / attribute | Meaning |
|---|---|
| `.inline-comment` | The annotation root. Retained from today. |
| `.inline-comment--pending` / `.inline-comment--applied` | State modifier; drives the rail colour. |
| `.inline-comment.is-expanded` | Set while the disclosure is open. |
| `.comment-disclosure` | The `<button>` that is the collapsed annotation and the disclosure trigger. Carries `aria-expanded` and `aria-controls`. |
| `.comment-glyph` | Codicon: `codicon-comment` when pending, `codicon-check` when applied. `aria-hidden`. |
| `.comment-text` | The one-line truncated text on the trigger. Flex child with `min-width: 0`. |
| `.comment-state` | The state label — the literal words `Pending` / `Applied`. |
| `.comment-body` | The full comment text, revealed on expand. Its `id` is what `aria-controls` points at. |
| `.comment-actions` | The action row. |
| `.comment-action--refine` / `--edit` / `--delete` | The three actions. Refine is present only when pending. |
| `data-ref-id` | The comment's id, on the annotation root. Retained from today. |

**Accessibility**: the trigger's accessible name is composed from the state and the comment text via Preact props (never string-built HTML). The disclosure state is `aria-expanded`. Anything an `aria-describedby` points at uses `.sr-only`, never `hidden` or `display: none`.

## Composer (edit reuse)

`InlineEditor` gains two optional props: `initialValue?: string` (pre-fills the textarea) and `submitLabel?: string` (defaults to `Add Comment`; the edit flow passes `Save`). Everything else — the context-action row, the Escape/Cmd-Enter keys, the row mode — is unchanged.

## Messages

Added to `ViewerToExtensionMessage`:

```ts
{ type: 'editComment'; id: string; comment: string }
```

Unchanged and still the only other comment messages: `addComment`, `removeComment`, `runDocRefinement`.

## Verbatim constraints (copied exactly from the spec)

- Quiet surface: `color-mix(in srgb, var(--text-muted) 12%, transparent)`
- Readable text: `--text-body` / `--text-primary` — never `--text-secondary` / `--text-muted`
- Truncation trio: `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`, plus `min-width: 0` on the flexible child
- Screen-reader-only content: `.sr-only`

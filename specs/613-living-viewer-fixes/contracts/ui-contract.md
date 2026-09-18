# UI Contract: Living Viewer Fixes

The identifiers tests and stories code against. Copied verbatim from the spec.

## Functions

```ts
// src/core/utils/capabilityNames.ts
export function readableName(name: string): string;
export function stripSharedLeadingWords(labels: string[]): string[];

// src/features/spec-viewer/livingDocs.ts (signature unchanged)
export function approveLivingText(content: string, heading?: string): string | null;
```

- `approveLivingText(content)` with a banner and no markers returns the content without the banner.
- `approveLivingText(content)` with neither returns `null`.
- `approveLivingText(content, heading)` leaves the banner while another marker remains.
- `stripSharedLeadingWords(['Commands Living', 'Commands Living Load'])` returns `['Living', 'Living Load']`.
- `stripSharedLeadingWords(['Core'])` returns `['Core']`.

## Living bar

| Condition | Button label | Message |
|---|---|---|
| draft, N adopted > 0 | `Approve all N` | `{ type: 'approveSpec', documentType: 'spec' }` |
| draft, 0 adopted | `Approve spec` | same |
| not a draft, 0 adopted | no approve button | |

## Markers

Passed through `preprocessHtmlComments` and dropped by the renderer's marker-line skip: `touches:`, `adopted:`, `reviewed:`, `aligns:`, `capability:`. Any other comment still becomes a "Template Instructions" disclosure. A marker inside a code fence still renders as code.

## CSS

- `.living-req-remove`, `.living-req-approve`: `min-height: 24px; padding: 2px 10px`, font `var(--font-family)`.
- `.living-req-remove`: neutral at rest, `var(--error)` colour and border on hover only.
- `.spec-toc-link--requirement`: no `border-left`, no guide `margin-left` or `padding-left`. `.spec-toc-link--h3` is unchanged for feature specs.
- `.spec-toc-cov--unknown`: removed. `.spec-toc-cov` renders only with a `spec-toc-cov--state-adopted`, `--state-drifted` or `--state-new` class.

## Tree

- Group label for `capabilities/companion-commands/`: `Companion Commands`.
- Its leaves: `Assembly`, `Capture`, `Completion`, `Living`, `Living Load`, `Living Markers`, `Nodes`, `Pipeline`.
- Icons: drifted `warning`, missing `circle-outline`, healthy none, folders and tier rows unchanged.
- Tooltip first line starts with the exact capability name.

## Overview card

Group labels `Updated by this run` and `Read for context`. No `folded back` text anywhere in the card.

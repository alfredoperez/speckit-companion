# Living Specs — GUI surfacing in the viewer (LS·7)

## Summary

When a feature touches one or more **living specs** (durable capability specs), the spec-kit side already records which capabilities were loaded into context at specify time and which were folded back at completion. Today that information is invisible in the VS Code viewer. This feature surfaces it: a small, read-only Activity card that shows the living specs a feature loaded and synced — Companion's lightweight answer to the OpenSpec Dashboard.

This is the **GUI half** of the living-specs work (the VS Code / webview side). It only *displays* data that LS·2 and LS·3 already write into `.spec-context.json` under `livingSpecs`. It writes nothing.

## User Stories

### US1 — See which living specs a feature touched (P1)

As a developer reviewing a feature spec in the viewer, I want to see which durable capability specs the feature loaded into context and which it folded its changes back into, so I can understand the feature's relationship to the project's living specs without leaving the viewer.

**Acceptance**
- When the spec's `.spec-context.json` carries `livingSpecs.loaded` (a non-empty list of capability names), the Activity panel shows a *Living specs* card listing the loaded capabilities.
- When it also carries `livingSpecs.synced`, the card marks those capabilities as folded back (synced).
- When neither list is present (or both are empty), the card renders nothing — a feature with no living-specs context shows no new UI (opt-in display).

### US2 — Stay read-only and safe (P2)

As a maintainer, I want the new surface to be display-only and to honor the webview safety invariants, so it cannot inject user data into the DOM or break accessibility.

**Acceptance**
- The card never writes back to `.spec-context.json`.
- Capability names (user-authored data) are rendered as element text, never interpolated into an HTML attribute through `innerHTML`.
- The card hides itself when empty, like every other Activity card.

## Functional Requirements

- **FR-001** — The extension's `ViewerState` derivation reads `livingSpecs.loaded` and `livingSpecs.synced` from `.spec-context.json` and exposes them as a normalized `livingSpecs` object on `ViewerState` (string arrays; absent when no data).
- **FR-002** — A new webview Activity card renders the loaded capabilities, marking each that also appears in `synced` as folded back.
- **FR-003** — The card returns `null` (renders nothing) when there is no `livingSpecs` data, so existing specs are unaffected.
- **FR-004** — Reading the field must tolerate malformed shapes (non-array, non-string entries) and coerce to a safe `string[]`, like the existing string-array passthroughs.

## Non-Functional Requirements

- **NFR-001** — No new `.spec-context.json` fields are written by this change; it is read-only display.
- **NFR-002** — Honors the CLAUDE.md webview invariants (no user data into HTML attributes via `innerHTML`; sr-only for aria; `e.target instanceof Element` guards where applicable).
- **NFR-003** — `npm run compile && npm test` stays green; the new card has a render test that asserts the data→DOM mapping for loaded-only, loaded+synced, and none.
- **NFR-004 (evidence)** — The data→DOM mapping is proven by automated webview render tests. The visual look is not asserted by the tests and needs manual verification.

## Out of Scope

- The "move a spec closer to the code" relocate action (mentioned in the ticket as a future surface) — not built here; this ticket lands the loaded/synced display.
- Drift state display — `livingSpecs` carries only `loaded`/`synced` today; drift is surfaced by the LS·6 drift command, not this card.
- Any writing of `livingSpecs` data (that is LS·2/LS·3, already merged).

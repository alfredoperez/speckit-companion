# Spec: Step Button Loading State

**Slug**: 099-step-button-loading-state | **Date**: 2026-05-21

## Summary

The spec viewer's footer next-step button flips to the *following* step's label
the instant it is clicked — before the AI CLI has produced the current step's
artifact. Clicking "Tasks" immediately relabels the footer to "Implement" even
though `tasks.md` does not exist yet, falsely implying the step is complete and
letting the user skip a real artifact. This feature adds an interim, disabled
"Generating <step>…" state that only re-enables to the next step's label once the
step's artifact is detected on disk with non-trivial content, with a manual
completion fallback and timeout recovery so the UI never strands in the loading
state. The same affordance governs every step transition.

## Requirements

- **R001** (MUST): While a step is generating, the footer's forward button is
  rendered disabled with a spinner and a label of the form `Generating {step}…`
  (e.g. `Generating Tasks…`) instead of showing the next step's label.
- **R002** (MUST): The forward button re-enables and shows the next step's label
  **only after** the just-run step's completion is detected — never on click
  alone.
- **R003** (MUST): Primary completion detection is `{step}.md` existing on disk
  **and** containing non-trivial content (a length/structure guard that rejects
  empty or half-written files); a stub file does not count as complete.
- **R004** (MUST): The disabled/loading affordance and completion logic apply to
  **all** step transitions — specify→plan, plan→tasks, tasks→implement, and
  implement→done — not only tasks→implement.
- **R005** (MUST): Recovery — if completion detection times out or the user backs
  out of the running step, the button returns to the **current** step's label
  (re-enabled) rather than remaining stranded in the `Generating…` state.
- **R006** (SHOULD): A manual "Mark step complete" confirmation is available as an
  alternative completion path, for when auto-detection is unreliable or the AI
  fails silently. Clicking it advances the button to the next step's label.
- **R007** (SHOULD): Completion detection reuses the viewer's existing
  refresh / file-watch mechanism (`refreshIfDisplaying` on `*.md` create/change);
  no new polling loop or dispatch-path change is introduced.
- **R008** (MAY): The `Generating…` state surfaces an elapsed indicator consistent
  with the step-tab pulse so the user can tell a long-running step from a stalled
  one.

## Scenarios

### Forward button during a normal step transition

**When** the user clicks the footer's next-step button (e.g. "Tasks") and the AI
CLI has not yet written `tasks.md`
**Then** the button is disabled, shows `Generating Tasks…` with a spinner, and
does **not** advance to "Implement" until `tasks.md` exists with non-trivial
content — at which point it re-enables labeled "Implement".

### Empty or half-written artifact

**When** the step's `{step}.md` is created but is empty or contains only a stub /
partial frontmatter
**Then** the button stays in the disabled `Generating…` state (the non-trivial
content guard treats the file as incomplete).

### Timeout or back-out recovery

**When** completion is not detected within the recovery window, or the user
navigates away from / cancels the running step
**Then** the button returns to the **current** step's label, enabled, instead of
remaining stuck on `Generating…`.

### Manual completion fallback

**When** auto-detection has not fired but the artifact is in fact ready (e.g. the
AI failed silently) and the user clicks "Mark step complete"
**Then** the step is treated as complete and the button advances to the next
step's label.

### Final step

**When** the `implement` step is running and then completes
**Then** the same loading→completion affordance applies, ending at the
spec-closure surface (`Mark Completed`) rather than a further step label.

## Non-Functional Requirements

- **NFR001** (SHOULD): Completion is reflected in the footer within one refresh
  cycle of the file watcher firing (no perceptible extra lag beyond the existing
  debounce).
- **NFR002** (SHOULD): The disabled `Generating…` button is conveyed accessibly
  (native `disabled` semantics; the spinner is decorative/`aria-hidden` and the
  state is readable from the button label).

## Out of Scope

- Redesign of the step tab strip itself.
- Overhaul of polling cadence or the file-watch debounce architecture.
- Changes to how the AI CLI command is dispatched (`executeStepInTerminal`).
- Changing the canonical `.spec-context.json` status vocabulary or the
  spec-060 context-tracking model beyond what the button state needs.

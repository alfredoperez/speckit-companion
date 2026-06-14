# Research: Composable Command Nodes

**Feature**: 172-composable-command-nodes
**Date**: 2026-06-14

This document resolves the open questions behind the reshape: where shared logic physically lives today, what an "assemble + verify" mechanism should look like, how to keep a plain-terminal command self-contained, and what FR-015 must revert.

---

## Decision 1 — Composition mechanism: marker-fenced parts expanded by a build step

**Decision**: Introduce a `_parts/` directory of single-source blocks (sizing, routing, timing, self-advance). Each command body keeps a named HTML-comment fence per block; a build script fills the region between the fences from the matching part file. The committed/shipped command `.md` files stay **whole** (fences contain the expanded text), so a plain terminal still reads a complete command. A parity check re-expands and diffs against the committed file byte-for-byte.

**Rationale**:
- The codebase already uses exactly this fence convention for timing: `<!-- speckit-companion:timing -->…<!-- /speckit-companion:timing -->` is embedded verbatim in 11 bodies, and `check-shape-parity.py` asserts each body contains the partial. Generalizing "one named block, substring-checked" to "N named blocks, region-equals-part-checked" is the smallest change that delivers single-source logic.
- Keeping the expanded text **in** the committed file means nothing depends on a runtime/install-time assembler. spec-kit's installer copies command files as-is, and a plain terminal reads the shipped file directly — both see a whole command (FR-008, SC-004). Assembly is an **authoring/build-time** step, not an install-time one; "joined when installed" is satisfied because what gets installed is already joined.
- Byte-for-byte parity (FR-002, SC-001) falls out naturally: `golden == build(parts)` is a file diff.

**Alternatives considered**:
- *Install-time assembly inside the spec-kit installer*: rejected. The installer is spec-kit core (not ours to modify reliably), and it would make the on-disk command non-self-contained until install runs — contradicting the "plain terminal, no extension" requirement.
- *Runtime include resolution by the AI*: rejected. Depends on the assistant fetching part files at run time; breaks the self-contained guarantee and the parity gate.
- *Manifest-only (parts referenced, never expanded in the committed file)*: rejected for the same self-contained reason; a one-shot terminal reading the raw command would see an unresolved `{{> part}}` token.

---

## Decision 2 — The parity gate: extend `check-shape-parity.py` into golden + region check

**Decision**: Capture today's assembled command set as a frozen golden snapshot before decomposition. Evolve `check-shape-parity.py` from "every body contains the timing partial" into the gate that (a) re-expands every command from its parts and asserts the result equals the committed file byte-for-byte, and (b) asserts the committed file equals the captured golden for every command not intentionally changed. Wire it into the existing pre-commit/CI path that already runs the script.

**Rationale**:
- FR-003 says "the existing parity check MUST be used as the gate" — `check-shape-parity.py` is that script. It already enumerates the 11 bodies and already fails loudly (exit 1) on drift, so it is the natural home rather than a parallel checker.
- The golden snapshot (FR-001) is the proof that decomposition changed nothing: it is captured once, pre-refactor, from the current whole files.

**Alternatives considered**:
- *A brand-new parity script*: rejected — duplicates the enumerate-and-fail logic the spec explicitly says to reuse.
- *Git-history diff as the gate*: rejected — not reproducible in CI on a fresh checkout and not a hard byte equality.

---

## Decision 3 — Which blocks become parts

**Decision**: Four single-source parts:
1. **sizing** — the small/large definition and the 5-files / 10-tasks thresholds (today duplicated in `classify.md`, the specify preset body, and implied by the workflow `switch`).
2. **routing** — "which step runs next given the size" prose.
3. **timing** — the existing `timing-partial.md`, moved/renamed under `_parts/`.
4. **self-advance** — the US3 handoff text (read the workflow definition for the next step, continue, pause at gates, land at `completed`, stay manual where the environment can only run one step).

**Rationale**: These are exactly the cross-cutting rules the spec names as duplicated (FR-004/005/006) plus the one new shared behavior US3 introduces. The numeric thresholds live in `sizing` once; the workflow `switch` references the same constants by description rather than re-deriving them.

**Alternatives considered**:
- *Only extract timing*: rejected — leaves sizing forked across three files, which is the duplication the feature exists to kill (SC-002).
- *Extract every shared sentence*: rejected — over-decomposition; the four blocks above are the ones with real duplication or real cross-command reuse.

---

## Decision 4 — Self-advance is prompt text, not a loop

**Decision**: US3 self-advance is delivered as the `self-advance` part appended to each pipeline command: an instruction that, on an environment whose assistant keeps acting, the assistant reads the workflow definition to find the next step and continues, pausing at review gates and ending at `completed`; on a one-shot environment it simply stops and waits for the manual/panel trigger.

**Rationale**: FR-014 forbids requiring a separate headless run command in the everyday flow, and the Assumptions section states self-advance is "the assistant following the workflow definition's what's-next instructions, not a hard-coded loop." This degrades gracefully (FR-013): where the environment stops after one step, the handoff just doesn't fire and the run stays resumable.

**Alternatives considered**:
- *Extension-driven auto-dispatch of the next command*: out of scope here — that is #309 (auto-mode), which builds on this. This feature only makes the command-level handoff possible.

---

## Decision 5 — FR-015 revert: stop driving panel steps from the workflow definition

**Decision**: Revert the panel's "read `.spec-context.json.workflow` → load the workflow yml → derive steps" path so the driving logic lives in the commands, not the panel. Concretely, return the viewer's step resolution to the static canonical pipeline (the existing `DEFAULT_WORKFLOW` fallback) and remove the workflow-definition lookup added recently.

**Seams identified**:
- `src/features/workflow-editor/workflow/specInfoParser.ts` — `resolveStepsSync()` reads context, looks up `getWorkflow(ctx.workflow)`.
- `src/features/spec-viewer/specViewerProvider.ts` — `resolveWorkflowSteps()` → `getFeatureWorkflow()` → `getWorkflow()`.
- `src/features/workflows/workflowManager.ts` — `getFeatureWorkflow()` reads context and resolves the workflow.
- `src/features/spec-viewer/messageHandlers.ts` — reads `featureCtx.workflow` to pull workflow commands.

**Rationale**: FR-015 says this earlier change is "the wrong layer and must be removed so this change lands cleanly in the commands." The panel should not be the place that knows the pipeline shape; the commands (and the workflow definition they read) own that.

**Open verification for implement**: confirm exactly which of these call sites must change vs. stay (e.g. the workflow *editor* legitimately reads workflow yml; only the *spec viewer's step-driving* path is in scope). The revert must keep the viewer rendering its footer buttons from the static pipeline + `.spec-context.json` status, not from the workflow file.

---

## Decision 6 — Capture is untouched (FR-016 / SC-007)

**Decision**: No change to `write-context.py`, `derive-from-files.py`, the lifecycle hooks, or the `promptBuilder.ts` preamble. The timing part keeps the same text it has today, so the same finish-only journaling and the same `.spec-context.json` history get written before and after the reshape.

**Rationale**: The reshape is a source-organization change; the bytes the AI receives for timing are identical, so capture output is identical by construction. The eval (`eval-speckit-extension` / `tests/test_context.py`) is the regression net.

---

## Resolved unknowns

| Unknown | Resolution |
|---|---|
| Does an include/part mechanism exist? | No — physical duplication + substring parity check. We add the part expansion. |
| Does install-time join exist? | No — 1-to-1 copy. Assembly is build-time; shipped files stay whole. |
| Where is the "existing parity check"? | `speckit-extension/scripts/check-shape-parity.py`. |
| Where does sizing duplicate? | `commands/speckit.companion.classify.md`, `presets/companion-standard/commands/speckit.companion.specify.md`, `workflows/speckit-companion.workflow.yml`. |
| What does FR-015 revert? | Panel step-resolution from the workflow definition (four src seams above). |
| Risk to capture? | None if the timing part text is byte-identical; guarded by the eval. |

# Implementation Plan: CLI/Terminal Install Nudge for the Companion Extension

## Summary

Add a single, quiet, dismissable hint that offers to install the companion spec-kit extension when the extension dispatches a stock `/speckit.*` command to a terminal-CLI provider without the companion extension installed. The hint reuses the entire #543 install-nudge infrastructure — the one-click install command (`speckit.companion.installNudge`), the shared persisted dismissal (`installNudgeDismissed`), and the `isCompanionInstalled(root)` detector — so there is no parallel system and no second dismissal to manage. A new terminal-vs-editor provider classifier decides applicability; a pure gate predicate decides whether to render; a thin wrapper resolves the inputs, fires the same-gated `terminal`-surface telemetry, and shows a non-blocking notification. It is wired into the terminal dispatch chokepoints in `specCommands.ts`.

## Project Structure

```
src/
├── ai-providers/
│   └── aiProvider.ts              # + providerDispatchesToTerminal(type) classifier + EDITOR_DISPATCH_PROVIDERS set
├── speckit/
│   └── cliInstallNudge.ts         # NEW — shouldShowCliInstallNudge (pure gate) + maybeShowCliInstallNudge (wrapper)
├── core/
│   └── telemetry.ts               # + 'terminal' to InstallPromptSurface + INSTALL_PROMPT_SURFACES
└── features/specs/
    └── specCommands.ts            # call maybeShowCliInstallNudge at the terminal stock-command dispatch sites

src/speckit/__tests__/cliInstallNudge.test.ts   # NEW — gate + telemetry-parity tests
src/ai-providers/__tests__/…                     # classifier exhaustiveness test (existing provider test suite)
README.md                                        # "Get Companion" / install-nudge section: note the terminal surface
```

**Structure Decision**: The nudge logic lives in a new `src/speckit/cliInstallNudge.ts` next to the existing `specKitExtensionInstallCommands.ts` — the whole install-adoption surface already lives under `src/speckit/`. The provider classifier belongs in `aiProvider.ts` beside the other provider-registry facts. No new command or setting is added; the feature reuses `speckit.companion.installNudge` and `speckit.companion.dismissInstallNudge`.

## Constitution Check

No project constitution (`.specify/memory/constitution.md`) defines formal principles for this repo; the governing conventions are in `CLAUDE.md` and `.claude/review-checklist.md`. Assessed against those:

| Principle (from CLAUDE.md / review-checklist) | Assessment |
|---|---|
| Extension isolation — implement only in `src/` + dispatched prompt text, never `.claude/**` or `.specify/**` | PASS — all changes are in `src/`; no `.claude`/`.specify` edits. |
| Reuse the install-nudge system, no parallel system | PASS — reuses install command, dismissal key, detector, telemetry event. |
| Telemetry `shown` gated on the exact render condition (#543, #506) | PASS — the same `shouldShowCliInstallNudge` predicate gates both the emit and the render. |
| Guard a provider handler over the full manifest enum + neutral fallback (#435, #546) | PASS — classifier keys off an editor-provider set with a neutral default (unknown ⇒ terminal), pinned by an exhaustiveness test. |
| Never block/fail the host command (best-effort surfaces) | PASS — the wrapper is wrapped in try/catch and shows a non-modal notification. |

No violations; Complexity Tracking omitted.

## Key Decisions

See `research.md` for Decision / Rationale / Alternatives on: the surface choice (VS Code notification vs prompt-prepended hint), terminal-vs-editor classification strategy, the double-nudge guard against the existing fallback warning, and the session-guard placement.

## Key Entities (folded from data model)

- **`shouldShowCliInstallNudge(input)`** — pure predicate over `{ specKitDetected, companionInstalled, dismissed, providerDispatchesToTerminal, alreadyShownThisSession }`, returns `true` only when spec-kit is detected, companion is absent, not dismissed, the provider dispatches to a terminal, and it has not already shown this session. Both the production wrapper and the tests call this exact function (no re-derived inline condition).
- **`maybeShowCliInstallNudge(context, root, providerType)`** — resolves the five inputs (detection via `.specify` presence, `isCompanionInstalled(root)`, `installNudgeDismissed` from `globalState`, `providerDispatchesToTerminal(type)`, module session flag), calls the predicate, and on `true` sets the session flag, fires `reportInstallPromptShown('terminal')`, and shows a non-blocking `showInformationMessage` with `Install` and `Don't show again`. Wrapped so any error is swallowed.
- **`InstallPromptSurface`** — the existing union extended with `'terminal'`, also added to `INSTALL_PROMPT_SURFACES`.
- **`providerDispatchesToTerminal(type)`** — `!EDITOR_DISPATCH_PROVIDERS.has(type)`, where `EDITOR_DISPATCH_PROVIDERS = { IDE_CHAT, CLAUDE_VSCODE, WIBEY_VSCODE }`.

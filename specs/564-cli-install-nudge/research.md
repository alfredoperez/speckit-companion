# Research: CLI/Terminal Install Nudge

## Decision: Surface is a non-blocking VS Code notification, not a prompt-prepended hint

- **Decision**: Show the nudge as a single non-modal `showInformationMessage` with `Install` / `Don't show again` actions, fired at the terminal dispatch chokepoint.
- **Rationale**: The whole #543 install-adoption system is VS Code notifications/banners plus a persisted dismissal. A notification reuses that infrastructure verbatim (same install command, same dismissal, same telemetry event) and stays dismissable and out of the run. A prompt-prepended hint would inject text into the AI CLI's prompt on every dispatch — impossible to dismiss, easy to make noisy, and it changes the dispatched command's content (a correctness risk), which contradicts "never block a run".
- **Alternatives considered**: Prepending a one-line "install the companion extension" sentence to the dispatched prompt — rejected: not dismissable, repeats every dispatch, and mutates the command payload.

## Decision: Classify providers as terminal-vs-editor via an editor set with a neutral default

- **Decision**: Add `providerDispatchesToTerminal(type)` = `!EDITOR_DISPATCH_PROVIDERS.has(type)`, where the editor set is the three in-editor chat/panel providers (`IDE_CHAT`, `CLAUDE_VSCODE`, `WIBEY_VSCODE`). Everything else dispatches to a terminal.
- **Rationale**: The in-editor providers already surface the #543 nudges, so they must be excluded; every other provider extends `CliTerminalProvider` or otherwise runs `executeInTerminal` against a real terminal. Keying off the small, stable editor set (rather than enumerating the eight terminal providers) means a newly-added CLI provider is nudge-eligible by default — the safe direction for a discovery feature. An exhaustiveness test over the `AIProviders` enum forces any future provider to be classified and pins the three editor providers as `editor`.
- **Alternatives considered**: (a) A `dispatchTarget` field on `ProviderPaths` for all eleven providers — more thorough but a much larger diff touching every provider entry and the registry validator; deferred as gold-plating for this scope. (b) `instanceof CliTerminalProvider` at runtime — misses `GeminiCliProvider`/`WibeyCliProvider` which implement `IAIProvider` directly, and couples the gate to class hierarchy.

## Decision: Guard against a double notification with the existing fallback warning

- **Decision**: In `executeWorkflowStep`, only fire the nudge when the dispatch did **not** fall back (`!resolution.fellBack`). The companion→stock fallback path already shows its own one-click install warning.
- **Rationale**: A `/speckit.companion.*` command that downgrades to stock because the extension is missing already surfaces an install prompt via `resolveDispatchWithFallback`. Firing the terminal nudge in the same dispatch would show two notifications for one action. The new nudge exists for the case the fallback never covers: a **stock-workflow** terminal dispatch (`speckit.specify` etc.), where `fellBack` is false and no nudge exists today.
- **Alternatives considered**: Suppressing the fallback warning in favor of the new nudge — rejected: the fallback warning carries workflow-specific context ("running the standard flow instead") that the generic hint does not.

## Decision: Session guard lives in the wrapper, predicate stays pure

- **Decision**: A module-level `shownThisSession` flag lives in the wrapper (`maybeShowCliInstallNudge`) and is passed into the pure `shouldShowCliInstallNudge` predicate as `alreadyShownThisSession`. A test-only reset clears it.
- **Rationale**: Keeping the predicate pure lets tests exercise every gate combination deterministically without touching module state, and lets both production and tests call the exact same function (avoids the "test re-implements the condition" trap). The dedupe slot is only burned after a decision to show, mirroring the existing `reportInstallPromptShown` dedupe discipline.
- **Alternatives considered**: Session flag inside the predicate — rejected: makes the predicate impure and hard to test across combinations.

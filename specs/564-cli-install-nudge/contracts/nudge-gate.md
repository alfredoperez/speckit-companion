# Contract: CLI Install Nudge Gate

The tests and the production dispatch code both code against these exact identifiers.

## `providerDispatchesToTerminal(type: AIProviderType): boolean`

- Location: `src/ai-providers/aiProvider.ts`
- Returns `false` for the in-editor chat/panel providers (`IDE_CHAT`, `CLAUDE_VSCODE`, `WIBEY_VSCODE`); `true` for every other provider, including unknown values (neutral default = terminal).

## `shouldShowCliInstallNudge(input): boolean`

- Location: `src/speckit/cliInstallNudge.ts`
- `input`: `{ specKitDetected: boolean; companionInstalled: boolean; dismissed: boolean; providerDispatchesToTerminal: boolean; alreadyShownThisSession: boolean }`
- Returns `true` **only** when: `specKitDetected && !companionInstalled && !dismissed && providerDispatchesToTerminal && !alreadyShownThisSession`. Any other combination returns `false`.

## `maybeShowCliInstallNudge(context, root, providerType): void`

- Location: `src/speckit/cliInstallNudge.ts`
- Resolves the five predicate inputs, calls `shouldShowCliInstallNudge`, and on `true`:
  - marks the module session flag,
  - fires `reportInstallPromptShown('terminal')` (same gate as render),
  - shows a non-blocking `showInformationMessage` with `Install` → `speckit.companion.installNudge` (surface `'terminal'`) and `Don't show again` → `speckit.companion.dismissInstallNudge`.
- Never throws — any error is swallowed so the dispatched command always proceeds.

## Telemetry surface

- `InstallPromptSurface` union and `INSTALL_PROMPT_SURFACES` set (in `src/core/telemetry.ts`) gain the value `'terminal'`.
- Event: `companion.installPrompt` with `{ action: 'shown' | 'clicked', surface: 'terminal' }`. No new personal data; gated on `speckit.telemetry`.

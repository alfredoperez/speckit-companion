# Contract: Telemetry Pipeline

The identifiers below are pinned — several verbatim by the spec's Verbatim Constraints — and the implementation MUST use these exact strings.

## Module surface (frozen — consumers are the ~20 call sites)

```ts
// src/core/telemetry.ts — public API, unchanged by this feature
sendTelemetryEvent(name: string, properties?: Record<string, string>): boolean
class TelemetryService { sendEvent(name, properties?): boolean; dispose(): void }
initTelemetry(service: TelemetryService): void
reportInstallPromptShown(surface) / reportInstallPromptClicked(surface)
reportSpecOpened(specKey) / reportLivingSpecOpened(specKey)
reportLivingSpecDrift() / reportLivingSpecSync() / reportSteeringOpened()
buildActivatedProperties(snapshot) / getSpecTelemetryContext(specDir)
```

Removal: `APP_INSIGHTS_CONNECTION_STRING` is deleted with the old backend; the replacement constant is `POSTHOG_PROJECT_API_KEY` (empty string ⇒ no transport constructed, nothing sent).

## Gate contract (verbatim-pinned APIs)

- Editor-wide gate: `vscode.env.isTelemetryEnabled` (initial value) + `vscode.env.onDidChangeTelemetryEnabled` (live updates).
- Extension gate: `speckit.telemetry` boolean setting, read per send.
- An event is sent only when **both** gates are open; either gate closing stops all events without restart.

## Funnel contract (verbatim-pinned identifiers)

- Event name: `companion.installPrompt`
- Actions: `shown`, `clicked`
- Surfaces (closed allow-list): `createSpec`, `activity`, `sidebarBadge`, `pinnedRow`, `welcome`, `terminal`, `activation`
- PostHog funnel definition: step 1 = `companion.installPrompt` where `action = shown`; step 2 = `companion.installPrompt` where `action = clicked`; breakdown by `surface`.

## Wire contract

- Method/URL: `POST https://us.i.posthog.com/i/v0/e/`
- Headers: `Content-Type: application/json`
- Body: the capture payload in [data-model.md](../data-model.md) — `api_key`, `event`, `distinct_id` (= `vscode.env.machineId`), `properties` including `$process_person_profile: false` plus the common properties `extensionVersion`, `vscodeVersion`, `platform`.
- Delivery: one request per event, fire-and-forget; a non-2xx response or network failure is swallowed silently; no retries, no batching, no queue.

## Privacy contract (unchanged, testable)

- Properties are only enum-like values, stringified booleans, versions, counts, and the random per-spec `telemetryInstanceId`.
- Never sent: prompt content, file paths, spec names, capability names, custom workflow/step names, or any person-derived value.
- The five engagement events (`spec.opened`, `livingSpec.opened`, `livingSpec.drift`, `livingSpec.sync`, `steering.opened`) carry **no properties beyond the service-attached common facts**.

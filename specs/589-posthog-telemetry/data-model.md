# Data Model: Restore Telemetry on PostHog

No persisted application data changes. The entities here are the wire-level shapes the telemetry pipeline produces; the per-spec correlation id in `.spec-context.json` (`telemetryInstanceId`) is untouched.

## Usage Event (frozen catalog)

One named occurrence with string-valued, enum-like properties. The catalog and every property shape carry over from the old backend unchanged (FR-006):

| Event | Properties (event-specific) | Emitted when |
|---|---|---|
| `extension.activated` | `extensionVersion`, `vscodeVersion`, `speckitCliVersion`, `specCount`, `companionInstalled`, `defaultWorkflow`, `activityPanel`, `installPrompt`, `telemetry` | once per activation |
| `provider.selected` | `providerId` | provider changed |
| `workflow.selected` | `workflow` (`speckit` \| `custom`) | workflow picked |
| `phase.dispatched` | `phase`, per-spec id props | a pipeline step dispatched |
| `spec.created` | per-spec id props | spec created in the editor |
| `spec.completed` / `spec.archived` | per-spec id props | lifecycle action |
| `companion.installPrompt` | `action` (`shown` \| `clicked`), `surface` (closed allow-list) | install-banner funnel |
| `spec.opened`, `livingSpec.opened`, `livingSpec.drift`, `livingSpec.sync`, `steering.opened` | *(bare — none)* | engagement events |

Validation rules (existing, preserved): free-text values are coerced to allow-lists before sending (`phaseTelemetryId`, `profileTelemetryId`, `defaultWorkflowTelemetryId`, `coerceInstallPromptSurface`); bare events must stay bare.

## Common Properties (service-attached)

Merged by `TelemetryService` into every event's properties; event-specific keys win on collision.

| Field | Source | Note |
|---|---|---|
| `extensionVersion` | extension manifest | restores reporter behavior |
| `vscodeVersion` | `vscode.version` | " |
| `platform` | `process.platform` | " |

## PostHog Capture Payload (wire shape)

```json
{
  "api_key": "<POSTHOG_PROJECT_API_KEY>",
  "event": "<event name>",
  "distinct_id": "<vscode.env.machineId>",
  "properties": {
    "$process_person_profile": false,
    "extensionVersion": "…",
    "vscodeVersion": "…",
    "platform": "…",
    "…event-specific properties…": "…"
  }
}
```

State/lifecycle: constructed → posted once → forgotten. No queue, no retry, no persistence.

## Gate State (in-memory only)

| Field | Type | Transitions |
|---|---|---|
| `globalTelemetryEnabled` | boolean | initialized from `vscode.env.isTelemetryEnabled`; flipped by each `vscode.env.onDidChangeTelemetryEnabled` firing; subscription disposed with the service |

`sendEvent` fires only when `globalTelemetryEnabled && speckit.telemetry` (config read per send, as today).

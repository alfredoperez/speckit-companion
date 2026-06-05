# Contract: Footer State & Message Payloads

The viewer's footer is a UI contract between the extension (producer of state) and the webview (renderer). This contract makes the footer deterministic.

## C1 — Footer derives from `ViewerState` only

The webview footer (`FooterActions` and its children `CatalogFooter` / `GeneratingFooter`) MUST read every footer decision from the `viewerState` signal. It MUST NOT read `navState` for: status, button visibility, the generating/running-step gate, the recovery-timeout anchor, or button labels.

- `status` = `viewerState.status` (no fallback chain).
- button catalog = `viewerState.footer`.
- generating gate = `viewerState.{stepHistory, activeStep, runningStepArtifactReady, runningStepStartedAt}`.

Removed: the legacy `navState.footerState`-driven branch and the `vs?.status || ns.footerState?.specStatus || ns.specStatus || initialSpecStatus` chain.

## C2 — Completeness of footer-affecting messages

Any extension→webview message that can change what the footer shows MUST carry a **complete** `viewerState` (all fields in the data-model table populated for the current true state). No message may deliver a footer-relevant field as a partial that is merged onto a stale prior snapshot.

| Message | Trigger | Carries | Footer-relevant guarantee |
|---------|---------|---------|---------------------------|
| `contentUpdated` | tab switch, `*.md` change | full `viewerState` (+ navState for nav concerns) | complete |
| `viewerStateUpdated` | `.spec-context.json` change (post-action, external) | full `viewerState` | complete (today: ✗ partial navState; fix: viewerState already full → footer reads it) |

Both messages are built from **one shared payload builder** so their shapes cannot drift.

## C3 — Serialization boundary

`viewerState.footer` items are serialized to `{ id, label, scope, tooltip }`; the `visibleWhen` predicate is stripped (functions don't cross the postMessage boundary). The `approve` action's `label` is resolved to the next workflow step's label before serialization (`getApproveLabel`).

## C4 — Generating overlay & recovery

- The `GeneratingFooter` renders iff: running step has `startedAt`, no `completedAt`, `runningStepArtifactReady === false`, and `now - runningStepStartedAt <= RECOVERY_TIMEOUT_MS`.
- On `runningStepArtifactReady === true` OR timeout elapse, the footer MUST render `CatalogFooter` (normal buttons), never an empty/hidden action bar.
- The recovery timer remains client-side and re-renders when the window elapses without a new message.

## C5 — Idempotence

Rendering the footer twice from the same `viewerState` MUST yield the identical button set and order (SC-001). Re-opening a spec at the same true state MUST yield the identical footer (Acceptance US1-2).

## C6 — No incremental mutation

The footer button set MUST be recomputed from `viewerState` on every render. Clicking a control MUST NOT imperatively add/remove a *different* control; the only way a button changes is a new `viewerState` reflecting a new true state (FR-002, FR-003).

# Research: install-prompt telemetry

## Decision: single event with an `action` dimension, not two event names

**Chosen**: One `companion.installPrompt` event carrying `action` (`shown` / `clicked`) and `surface`.
**Rationale**: The conversion query (`clicked / shown`) is one aggregation over one event partitioned by `action`; two event names would force a join. The dimension is a fixed literal, so it stays inside the privacy allow-list.
**Rejected**: `companion.installPrompt.shown` + `.clicked` as separate names — more surface area, harder to funnel, no privacy benefit.

## Decision: emit `shown` from the render/compute sites, deduped per session

**Chosen**: A module-level `Set<InstallPromptSurface>` in `telemetry.ts`; `reportInstallPromptShown(surface)` emits only on first sight per surface per host session. The Create-Spec provider calls it when it renders the banner visible; the spec-viewer calls it inside `computeShowInstallPrompt()` when the result is `true`.
**Rationale**: Both webviews server-render the banner HTML and regenerate it on every refresh/content update, so an un-deduped emit would fire on every render tick (the issue's explicit warning). The banner "mounts" server-side, so there is no client mount event to hook; the render decision is the only reliable signal, and dedupe makes it "once per shown occurrence."
**Rejected**: Emitting from the webview client on DOM mount — would require new postMessage plumbing in both webviews for no added fidelity; the server already knows when it decided to show the banner.

## Decision: emit `clicked` from the banner message handlers, not the shared install command

**Chosen**: Emit `reportInstallPromptClicked(surface)` in the two webview handlers that receive the banner's `installSpecKitExtension` postMessage (spec-editor `case 'installSpecKitExtension'`, spec-viewer `installSpecKitExtension` handler), then delegate to the existing command.
**Rationale**: `speckit.companion.installSpecKitExtension` is also invoked from the sidebar affordance and an upgrade menu. Emitting `clicked` in the shared command would count those as prompt conversions and inflate the rate. The banner handlers are reached only by the banner's Install button, so tagging them measures prompt conversion specifically.
**Rejected**: Emitting in `registerSpecKitExtensionInstallCommands` — simpler but wrong denominator; it would break the shown→clicked funnel.

## Decision: `companionInstalled` reuses the already-computed install probe

**Chosen**: `fireActivatedEvent` computes `isCompanionInstalled(root)` (the same probe that feeds the `speckit.companion.installed` context key) and reports it as `String(...)`.
**Rationale**: One fact, one derivation — the context key and the telemetry field read the same probe, so they cannot disagree. No new detection logic.
**Rejected**: A second presence check — would risk drifting from the context-key source of truth.

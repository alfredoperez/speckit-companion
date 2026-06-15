# Assemble the stock timing-carrier from parts so it stops drifting from upstream

## Overview

The stock command carrier (`companion-standard`) is the set of spec-kit command files the extension ships so durations stay honest on the stock workflow. Today the shared timing instructions inside those files are already maintained in one place — a future maintainer should be able to trust that and not have to re-discover it. This change makes that single-source guarantee impossible to break silently, and writes down honestly what is single-sourced today versus what would take a larger effort, so nobody re-attempts the hard half by accident.

## Functional Requirements

- **FR-001** A dev/CI check MUST fail if any `companion-standard` command body drops the shared timing part fence, so the single-source guarantee for timing cannot silently regress to a pasted copy.
- **FR-002** The check MUST add no new dependency and MUST change zero command bytes — it asserts presence/single-source only, it does not rewrite any carrier.
- **FR-003** The living design docs MUST record that each `companion-standard` carrier is the raw upstream spec-kit command template plus the single-sourced shared timing part (injected by a fence), so the carrier's true shape is documented, not re-derived.
- **FR-004** The docs MUST state that fully assembling the carrier's stock body from a separately-vendored upstream source is deferred, and why (no vendored upstream input exists in the repo today; adding one is a larger change than this anti-drift pass), so the deferred half is explicit and not silently dropped.
- **FR-005** The change MUST keep all three byte-parity gates green (`check-shape-parity.py`, `assemble-nodes.py --check`, `build-commands.py --check`) — no carrier output changes.
- **FR-006** The spec-kit extension's own README, CHANGELOG, and version MUST be updated in user-facing voice; the root README/CHANGELOG/`package.json` MUST NOT be touched.

## Success Criteria

- **SC-001** Deleting the timing fence from any one `companion-standard` command and running the parity check exits non-zero (the guard catches the regression).
- **SC-002** With the carriers unchanged, all three parity gates exit zero and `npm run compile && npm test` pass.
- **SC-003** A maintainer reading the design docs can tell, in one place, what is single-sourced today (timing) and what is deferred (the stock body), without reading the scripts.

## Assumptions

- The shared timing block is already single-sourced via the `<!-- speckit-companion:part timing -->` fence in all seven `companion-standard` commands (delivered by #315/#317), so the "edit timing in one place" acceptance of #310 is already met; this spec hardens and documents that, and defers the remaining vendored-body half.
- The carrier bodies are the raw, un-rendered upstream spec-kit templates (carrying `{SCRIPT}`, `__CONTEXT_FILE__`, `/memory/constitution.md` placeholders) — not the agent-rendered copies — so there is no existing in-repo source to assemble the stock body from byte-identically.
- The timing-presence guard belongs in the existing `check-shape-parity.py` (which already iterates every tracked body), so no new script or CI wiring is introduced.

## Approach

A small, byte-preserving anti-drift hardening — no carrier output changes.

- Add a timing-fence presence assertion to `speckit-extension/scripts/check-shape-parity.py`: for every `companion-standard/commands/speckit.*.md` body, fail if the `timing` part fence is absent. Reuses the existing iteration and `PART_OPEN`/`PART_FENCE` helpers; no new dependency, no byte change to any carrier.
- Update `docs/template-profiles.md` (the "Known limitations" drift entry, ~line 94): replace the "verbatim stock copy + partial; a generator could reduce hand-maintenance" wording with the resolved state — timing is single-sourced via the fence (locked by the parity check + the new presence guard), the stock body remains the raw upstream template, and full vendored-body assembly is deferred pending an upstream-vendor input.
- Add a short note to `speckit-extension/docs/node-model.md` describing the `companion-standard` carrier shape (raw upstream template + single-sourced timing fence) and the deferred vendored-body assembly, so the spec-kit-side doc carries the same map.
- Update `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` (user-facing voice, no internal symbol names) and bump `speckit-extension/extension.yml` `extension.version`. Root README/CHANGELOG/`package.json` untouched.

Dependencies: none beyond the already-merged parts mechanism (#315/#317).

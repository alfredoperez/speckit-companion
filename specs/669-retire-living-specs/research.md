# Research: Retire living specs

## Retired `write-context.py` flags

**Decision**: remove `--living-specs`, `--living-spec-skip` and `--fold-living-spec` outright.
**Rationale**: only the retired nodes and commands call them, and an upgrade replaces those bodies. Keeping them as no-ops leaves `living-` in the extension, which the acceptance grep forbids.
**Alternatives considered**: accept-and-ignore for one release. Rejected: a session already mid-run on an old body is the only caller, and it fails one optional bookkeeping write, not the step.

## Leftover `livingSpecs:` config

**Decision**: the loader already ignores unknown top-level keys, so nothing reads the block; the doctor adds one info line, `livingSpecs is retired; safe to delete`.
**Rationale**: quiet for every command, visible once where people look for health.
**Alternatives considered**: a warning on every config read. Rejected as noise on every step.

## Shared helpers in living files

**Decision**: move the glob matcher into `capture.py`; move `GitRunner`/`makeDefaultGitRunner` to `apps/vscode/src/core/utils/git.ts` and `unsupportedForRuntime` to `apps/vscode/src/core/utils/yamlSubset.ts`.
**Rationale**: the risk tier, the verified-freshness check and the steering config check use them; none is a living feature.
**Alternatives considered**: keep trimmed host files. Rejected: a file named for a retired feature misleads.

## On-save spec shape checker

**Decision**: delete `specShapeCheck.ts` and `specShapeDiagnostics.ts`.
**Rationale**: both stop unless `living-specs.yml` is enabled; their data source goes.

## Old-record card

**Decision**: keep `LivingSpecsCard` and `pickLivingSpecs`; chips render as text; drop the `living-specs.yml` enrichment.
**Rationale**: parent's call 1. The enrichment read the registry, which nothing maintains now.

## Site page

**Decision**: delete `results/living-specs.mdx`; redirect its address through the `MOVED` map to the new steps section, `/docs/steps#how-companion-keeps-specs`.
**Rationale**: the config already turns `MOVED` into redirects; targets must be final pages.

## Media and screenshots

**Decision**: drop the two living clips from the media manifest, the site and the capture tooling; leave every file in `docs/screenshots/` untouched; skip `clips:capture` and shots this ticket.
**Rationale**: CLAUDE.md forbids renaming or deleting screenshots; the owner's standing rule runs captures once at release QA.

## Fixture specs

**Decision**: keep `specs/_03_demo-living` and `specs/510-living-sync`.
**Rationale**: they are old records the viewer must still load; CI's strict quality check on 510 keeps proving that.

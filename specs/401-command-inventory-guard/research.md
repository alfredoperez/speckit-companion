# Phase 0 — Research

## Decision: the prune belongs upstream in the spec-kit CLI; this repository owns detection

**Decision.** Do not attempt to prune stale commands from this repository. Build a detector and repair the records that are already wrong, and report the pruning gap upstream.

**Rationale.** The delete path and the install records both belong to the spec-kit CLI. On reinstall the CLI merges the newly registered names onto the names it already had, so a name that disappeared from the manifest is never removed from the records; and its skill registration deliberately skips a skill whose directory already exists, so it will not overwrite a stale body either. Both behaviors live in CLI source this repository does not own and does not ship — patching them locally would be overwritten by the next CLI upgrade, and would be invisible to every other project. The evidence is on disk here: the install records list all eight retired command names and none of the eight current ones, for all eight agents.

**Alternatives considered.**
- *Patch the CLI in place.* Rejected — the file is vendored/site-packages code, replaced on every CLI upgrade, and a local edit would silently stop applying without anyone noticing.
- *Ship an uninstall/reinstall wrapper from this repository.* Rejected — it would duplicate the CLI's own delete logic against records the CLI owns and can change, and it only helps projects that happen to use this repository's wrapper rather than the documented `specify extension …` commands.
- *Document the workaround only.* Rejected as insufficient on its own — that documentation already exists in the changelog and it did not stop this repository's own records from going stale. Documentation with no check is the failure mode this feature exists to fix. It stays, with the detector added.

## Decision: derive the command list from the manifest through one shared reader

**Decision.** Add `declared_commands()` to `_command_parts.py` returning the `(name, file)` pairs from `provides.commands`, and repoint `package-manifest.py`'s existing `declared_command_files()` at it.

**Rationale.** The packaging guard already parses the manifest, but only for the `file:` values; the new check needs the `name:` values. Adding a second parser would put two regexes over the same block, which is precisely the "two paths to the same fact" failure the review checklist calls out — they would agree today and drift the first time the manifest's formatting changes. `_command_parts.py` already declares itself the single source of which command bodies are tracked, so it is the natural home, and repointing the existing caller means the repository ends with one manifest parser instead of two.

**Alternatives considered.**
- *A private parser inside the new script.* Rejected — a third copy of the same knowledge.
- *Parse with a YAML library.* Rejected — no `yaml` module is available in this environment, and the surrounding tooling is deliberately stdlib-only so it runs anywhere the extension does.

## Decision: discover the install areas, then assert each is known

**Decision.** Do not simply iterate a hardcoded list of install areas. Scan the repository root for any directory holding a file or directory whose name matches the Companion command pattern, then require every area found to be present in the known-areas table. An area that is found but not known is a hard failure.

**Rationale.** A hardcoded list is exactly how the check would silently shrink its own surface: a future `specify init --ai <new-agent>` adds an install area, the check has never heard of it, and it is skipped without a word — the same class of drift the check exists to catch, now hiding inside the check. Discovery-then-assert inverts that, so growth in the ecosystem surfaces as a loud failure telling the maintainer to add the area. This is the "fail loud on an unresolvable input" rule the review checklist states for new gates. The repository currently has seven such areas, and the scan finding an eighth should stop the build, not be ignored.

**Alternatives considered.**
- *Iterate the known table only.* Rejected for the reason above — silent under-scanning.
- *Scan and accept anything found, inferring the naming shape.* Rejected — inferring a naming convention from whatever files happen to be present is guesswork, and a wrong inference produces false orphans, which trains maintainers to ignore the check.

## Decision: check the install records as well as the files on disk

**Decision.** Hold the manifest against both the recorded command lists and the hook registrations, in addition to the files on disk.

**Rationale.** The records and the files fail independently, and in this repository they currently disagree with each other: the files on disk carry all seventeen current names, while the records carry the seventeen pre-rename names. A check that looked only at files would report this repository as perfectly healthy while its four automatic capture steps are registered under names that no longer exist — that is, while capture is pointed at nothing. The records are also what the uninstall path reads, so a stale record is what makes a later clean removal impossible.

**Alternatives considered.**
- *Files only.* Rejected — it would have passed on the exact broken state this feature was opened to address.
- *Records only.* Rejected — it would miss an orphaned file left behind by the CLI's skip-if-exists behavior, which is the orphan the original report described.

## Decision: gate the documentation from the same check

**Decision.** Fold the "every command appears in both documents" assertion into the same script rather than a separate documentation linter.

**Rationale.** It is the same question against the same authority — does surface X agree with the manifest — and one script means one place to update when a command is added. It also gives the documentation requirement teeth: the reference fell eleven commands behind precisely because nothing checked it. A separate linter would be a second thing to remember to run.

**Alternatives considered.**
- *A prose note in the contributing guide asking maintainers to update the docs.* Rejected — that convention already exists in the repository's own instructions and the reference still fell behind.
- *Assert only that the count matches.* Rejected — a count check passes when a command is added and an unrelated one is dropped in the same change. Match on names.

## Decision: exclude `examples/`, and say so in the check

**Decision.** The scan skips `examples/` explicitly, with the reason recorded next to the exclusion.

**Rationale.** Those sample projects hold deliberately frozen snapshots of the pre-rename command names — the rename commit stated that keeping them is the point, because rewriting them would falsify the record of what was decided at the time. Scanning them would report fifty-plus permanent orphans and make the check useless on day one. The exclusion needs its reason attached, or a future maintainer will "fix" it by removing it.

**Alternatives considered.**
- *Repair the sample projects to current names.* Rejected — it contradicts the documented decision to freeze them, and they are internally consistent old-name-only snapshots, not mixed states.

---
id: record-verified
name: Record what was verified
kind: control
command: implement
reads: [implement-exec]
---
6b. **Prove each requested rule where a reader meets it, before you call it verified.** For every requirement, at least one test drives the app's public surface (the rendered screen, the CLI, the API) in the exact condition the rule names, and none passes by reading internal state such as storage, a store or a private module. "Survives a reload" means building the app again from what storage kept and reading the screen; "sends in order" means counting the calls the app makes. A rule with no such test gets one now; if it fails, the code changes.

   Then name the risk in one line of your summary, `Risk: <item> (<why>)` or `Risk: none`, against these items: stored data or a stored format, security, a contract others consume, concurrency or ordering, delivery or dependencies, or behavior no test would catch. Before writing `Risk: none`, check whether your change edits code that behavior the request did not mention also uses.

7. **Capture what was verified and decided in one call** the moment validation ends (best-effort; skip silently if `python3` is unavailable). Include only the keys you have; on a clean run `concerns` is absent:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<judgement>", "result": "<outcome>"}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction, residual risk, or a `// simplified:` ceiling>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case>"}, {"req": "FR-004", "assumes": "<what it relies on without a test>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb>"
   }'; python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --verify-run "<what>::<command>" --verify-run "<what>::<command>"
   ```
   Every suite, build and lint goes through `--verify-run`, which runs the command and keeps its exit code. `verified` is only for what cannot be run, a manual pass or a judgement. A check you could not run is a `concerns` entry naming what was skipped; do **not** record a `--verified` for it.

8. **Set the review depth from the risk tier** in the same breath:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --risk
   ```
   It prints the tier the changed files call for; raise it with `--risk-raise <normal|high> "<reason>"` if you know more, never lower. Review the diff before it is committed at that depth: low is your own careful read, normal one independent review, high two. When the work becomes a pull request, paste `python3 .specify/extensions/companion/scripts/receipts.py --feature-dir <feature_directory>` into its body unedited.

9. **Mutation check, only when the project turned it on.** If `.specify/companion.yml` sets `mutation: { enabled: true }`, read `.specify/extensions/companion/commands/reference/mutation-check.md` and follow it. Otherwise skip this.

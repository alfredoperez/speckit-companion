---
id: record-verified
name: Record what was verified
kind: control
command: implement
reads: [implement-exec]
---
7. **Capture what was verified and decided** the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction, residual risk, or a `// simplified:` ceiling you left in the code>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case,other.test.ts>"}, {"req": "FR-004", "assumes": "<what it relies on without a test>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb, e.g. all tasks done, 18/18 tests pass>"
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. Emit one `--batch`. Include only the keys you actually have: an empty list is not the same as an absent one, and on a clean run `concerns` is genuinely absent.

   Record a check that can be run with `--verify-run "<what>::<command>"`: it runs the command and keeps the exit code, rather than taking your word for it. Every suite, build, lint and script goes that way. `--verified` stays for what genuinely cannot be run — a manual pass, a judgement — and reads in the viewer as your account rather than as evidence, which is what it is. Never write a `--verified` describing a command you ran: that is the case `--verify-run` exists for, and a typed result is indistinguishable from an imagined one. If a check could not be run at all, record that as a `--concern` naming what was skipped and why, and do **not** record a `--verified` for it.

   One `--verify-run` per runnable check and one `--verified` per judgement (a manual pass, a warning you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--assumes <req> "<what>"` per requirement the code relies on something no test checks (a library, the clock, the database), one `--decision` per genuine implementation choice. Record `--concern` only for real friction; on a clean run record none.

8. **Set the review depth from the risk tier**, once validation ends:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --risk
   ```
   It prints the tier the changed files call for. If you know something the files do not show, raise it with `--risk-raise <normal|high> "<reason>"`; it never goes down. Review the work before it is committed at that depth: low is your own careful read of the diff, normal is one independent review, high is two independent reviewers.

9. **Run the mutation check, only when the project turned it on.** If `.specify/companion.yml` sets `mutation: { enabled: true }`, run the project's mutation tool on the files this change touched (Stryker for JavaScript and TypeScript with the JSON reporter, mutmut for Python, then `mutmut export-cicd-stats`), and hand the report to the writer:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --mutation-report <reports/mutation/mutation.json or mutants/mutmut-cicd-stats.json>
   ```
   It records the caught count and marks weak each requirement whose tests caught no planted bug. Without the setting, skip this step.

# Plan: Converge finishes a Companion spec

**Scale note**: about 32 files in three disjoint areas: the pipeline wording (nodes, shared parts, the workflow), the writer and its readers (write-context, doctor, status), and the docs. Watch for any surface left saying implement writes completed, and for the one sanctioned write on a completed spec staying narrow.

## Summary

Implement's `complete` node keeps its living-spec accounting and fold but closes the step with `--step implement --advance` instead of `--mark-complete`, so the spec lands at implemented, and implement's handoff names stock `speckit.converge` next. The after-converge hook already completes a clean spec (#940), so manual, auto and stock runs all complete the same way. Auto repeats implement and converge until a pass appends nothing, capped at three passes with a concern; the workflow engine, which has no loop, ends on a converge step instead of mark-complete. The writer lets a converge start and finish through on a completed spec without touching its status or step, and the finish adds a concern naming the open tasks when converge appended any. The doctor counts the converge finish as a completion attempt, and status shows implemented as "next: converge".

## Project Structure

```text
apps/speckit-extension/
├── nodes/implement/{complete,handoff,_frame}.md, nodes/auto/{orchestrate,_frame}.md
├── presets/_parts/{self-advance,timing}.md
├── workflows/speckit-companion.workflow.yml, extension.yml
├── commands/*.md                                   # rebuilt
├── scripts/{write-context,doctor_checks,run_trace,status-context}.py
├── tests/{test_custom_steps,test_converge_completes,test_doctor,test_context,test_queue_batch}.py
├── docs/{commands,node-model}.md, README.md, CHANGELOG.md
apps/website/src/content/docs/docs/{steps/index,results/the-overview}.mdx
apps/copilot-canvas/com.github.copilot/extensions/speckit-companion/public/app.js, apps/copilot-canvas/CHANGELOG.md
.claude/commands/fix-tickets.md
```

**Structure Decision**: the one writer of completed stays `mark_spec_complete`, reached only from the after-converge hook in a pipeline run.

## Call paths

```calls a converge on a completed spec is recorded
  _main() @ apps/speckit-extension/scripts/write-context.py:442
~   update_context() @ apps/speckit-extension/scripts/write-context.py:178
+   _note_converge_on_completed() @ apps/speckit-extension/scripts/write-context.py:550
      append_capture_entries() @ apps/speckit-extension/scripts/capture.py:408
```

```states the spec's status around converge
Implementing: Tasks still being built. (start)
Implemented: Every task checked, converge not yet clean.
Completed: A converge pass found nothing left. (final)
Implementing -> Implemented: last task checked
Implemented -> Completed: converge appends nothing
Implemented -> Implementing: converge appends tasks
Completed -> Completed: converge appends tasks, concern recorded
grid:
Implementing | Implemented | Completed
```
note: the last edge adds a concern naming the open tasks; nothing moves a status backward.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: uses spec-kit's own converge and hooks. |
| II. Spec-Driven Workflow | PASS: done means a clean converge, as spec-kit defines it. |
| III. Visual and Interactive | PASS: no screen change in this slice; the viewer's converge step is slice 3. |
| IV. Modular Architecture | PASS: one completion writer, one narrow exception for converge. |

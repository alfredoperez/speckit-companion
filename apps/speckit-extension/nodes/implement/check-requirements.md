---
id: check-requirements
name: Check the requirements against the code
kind: gate
command: implement
reads: [implement-exec]
---
6a. **Read the recorded size first**: `.spec-context.json` → the `size` field, where a missing value means `normal`. At `simple` size, skip this check; at `normal` or `oversized`, run it.

**Hand the requirements and the diff to one worker that knows nothing about how you built this.** Re-reading your own work confirms your own reasoning, which is how a run ships a broken feature with every test green — so this check is only worth anything done by someone else.

Dispatch one worker with three things and nothing else: the **Functional Requirements** from `spec.md` verbatim, the diff of what this run changed (against the commit implement started from, new files included), and the project's conventions. No plan, no task list, no summary of your approach. Those are what you want checked; handing them over is what breaks the check, because a worker told why the code is right will agree that it is right.

Ask for one line per requirement, one of three verdicts, judging each requirement **as written** rather than as the implementation narrows it:

- **`met`** — name the code that satisfies it, not a restatement of it.
- **`missing`** — nothing in the diff does this.
- **`at risk`** — something does this and something else can undo it. Name both. This is the verdict that earns the node: a requirement can be satisfied in one place and defeated a few lines later by code that was already there, and both readings look reasonable alone. Tell it to say, too, whether a test covers the real screen the requirement describes or a component built inside the test file, because the second proves nothing about the app.

**An `at risk` closes with a test, never with an argument.** This is the whole point of the node and the one place it leaks: the reasoning that created a risk is the reasoning that will wave it away, and it sounds just as good the second time. A verdict answered with "that cannot happen because the library behaves this way" is not answered — that is a claim about the world, and the test is what settles it. Write the test that exercises the risk under the conditions the requirement names, not the conditions your implementation assumes. If the test passes, the risk was imaginary and you have proof. If you cannot write it, the risk is real and the code changes. A `missing` closes the same way: by code, not by explanation.

On a host without subagents, do the same check yourself from only those three things: set the plan and the task list aside, read each requirement against the diff as if someone else wrote it, and say in your summary that the check ran inline.

Anything you still disagree with after that goes in your summary as an open concern, in one sentence, so the next reader sees it. When the check ran, never record this step done with an unanswered `missing` or an untested `at risk`.

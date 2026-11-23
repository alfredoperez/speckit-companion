# Research

## Ask in the default node, not by swapping in the blocking variant

- **Decision**: the default `quality-checklist` asks the remaining questions as one table, only when markers remain.
- **Rationale**: the issue's goal is that the questions get asked. The blocking variant also writes a checklist file and loops up to three times, which every clean spec would then pay for.
- **Alternatives considered**: make `quality-checklist-blocking` the default in `_order.yml` (rejected: heavier for every run); a new node between draft-spec and quality-checklist (rejected: one more node for a few lines).

## Where an unattended run is detected

- **Decision**: the node reads `unattended` from the dispatched prompt or from `.spec-context.json`.
- **Rationale**: auto writes it to the run record before dispatching specify and also carries it in the prompt; the VS Code dispatch passes it in the prompt only.
- **Alternatives considered**: the run record only (rejected: misses the VS Code path).

## How an assumed answer is recorded

- **Decision**: one `--concern` per question whose note names the question and the assumed answer, plus the default under Assumptions in the spec.
- **Rationale**: concerns are what a reader sees in the Overview; a decision with `by: you` would claim the person chose it.
- **Alternatives considered**: a decision with `by: ai` (rejected: decisions read as settled choices, not guesses to check).

## Bug specs

- **Decision**: `draft-spec-bugfix` gains Non-goals and Verification plan; Change-level rules stays out of bug specs.
- **Rationale**: a fix still needs to say what it leaves alone and how it is proven; "Unchanged Behaviour" already covers most change-level rules.
- **Alternatives considered**: leave the variant alone (rejected: SC-003 covers every new spec).

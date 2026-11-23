# Research

## Where the size gate lives

- **Decision**: the first line of `check-requirements.md`.
- **Rationale**: no node is skipped by size anywhere; plan and tasks gate themselves in their own text, and a simple run still reaches implement.
- **Alternatives considered**: a size key in `_order.yml` (a second mechanism for one node).

## A host without subagents

- **Decision**: read the requirements and the diff yourself, fresh, without reopening the plan or tasks, and say so in the summary.
- **Rationale**: the check now runs by default, so it must work on every host; `review-gaps` already has the same fallback.
- **Alternatives considered**: no fallback (an instruction a Copilot or one-shot host cannot follow).

## Relation to the risk-tier review

- **Decision**: keep both.
- **Rationale**: the check asks "is each requirement met", the handoff review asks "is anything broken"; they read different inputs.
- **Alternatives considered**: folding the check into the review (the reviewer would see the plan, which the check must not).

# Specs Step History — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The shared derivation of a step's timing from the lifecycle log: which spans count as measured, and which steps read as folded by a fast-path run.

## Requirements

### A fast-path folded step is derived as folded, once

The shared step-history derivation SHALL mark a step folded when its own extension-stamped step-level start/complete pair spans under one second and its start lands within one second of the previous step's extension-stamped close — anchored on the stamped pair, never on the derived close, which can be a much later next-step start. The flag is independent of duration trust (a same-instant fold is folded but untrusted), is set nowhere else, and folded steps keep counting as measured timing coverage.

#### Scenario: a fast-path run's history is derived
- **WHEN** plan and tasks were stamped back-to-back inside the specify run
- **THEN** their derived entries carry the folded marker and specify's does not

#### Scenario: a sub-second step far from the previous close
- **WHEN** a step's stamped pair spans under a second but starts minutes after the previous step closed
- **THEN** its entry carries no folded marker

### A step's duration is trusted from any deterministic writer, gated on writer authority

The shared step-history derivation SHALL count a step's span as measured when the step carries exactly one step-level start from a deterministic writer and an ordered close (its own step-level complete, or the next lifecycle step's start) whose writer is at least as authoritative as the start's. Writers rank in two tiers: instrumented (`extension`, `cli`, `derive`, `user` — host- or in-command-script-observed) outranks agent (`ai` — a CLI/agent run's own writer-script boundary), which outranks any unrecognized writer. A run driven entirely through the CLI, whose ordered step boundaries are stamped `by:ai`, is therefore trusted, while an `ai` close over an `extension`-stamped start (a premature-finish masquerade) and a phase advanced with only a complete and no start each claim no duration. The existing anomaly guards — a single start, no completion before the start, no competing later start, no cross-phase overlap — continue to apply on top, and the `folded` flag stays defined over `extension`-stamped fast-path pairs only.

#### Scenario: a CLI-only run's history is derived
- **WHEN** every pipeline step carries an ordered `by:ai` step-level start and complete
- **THEN** all four phases count as measured timing coverage

#### Scenario: a premature agent finish over an extension start
- **WHEN** a step's start is stamped `by:extension` and an `ai` step-level complete lands immediately after
- **THEN** that step's duration is not trusted

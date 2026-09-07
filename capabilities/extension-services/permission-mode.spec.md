# Permission Mode — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The single-resolver contract for the permission mode that governs how a dispatched assistant session is launched; the module itself is a retired seam.

## Requirements

### Permission mode has exactly one resolver

The permission mode that governs how a dispatched assistant session is launched SHALL be read through one shared helper used by every provider, rather than being re-derived per call site. This area no longer holds an implementation — it is a retired seam whose behavior moved to the provider layer — and it must not grow a second one. [inferred: the module itself is now only a note recording where the behavior went; the single-resolver contract is read from that note, not from code here.]

#### Scenario: a new AI provider is added
- **WHEN** it launches a session
- **THEN** it reads the permission mode through the shared helper rather than reading configuration directly

## Uncovered

_None — the permission area contains no implementation; it is a single note pointing to the provider layer._

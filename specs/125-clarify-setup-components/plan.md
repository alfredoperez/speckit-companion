# Plan: Clarify Setup Components

**Spec**: [spec.md](./spec.md)

## Approach

Add one new top-level README section, **"Setup & Components"**, placed right after **Getting Started** (so the install steps flow straight into "what each piece is and whether you need it"). It carries a compact Required/Optional table plus three short prose paragraphs: what the extension does on its own, how `/speckit.*` dispatch relates to running spec-kit in a terminal, and why the shared on-disk spec files mean there's no extension-vs-CLI ownership conflict. Link out to the existing `docs/how-it-works.md` for the deep dive and reference (don't restate) the existing "Supported AI Providers" section for dispatch styles. Documentation only — no code, settings, or screenshots change.

## Files

### Modify

- `README.md` — insert a new `## Setup & Components` section after `## Getting Started`: a Required/Optional component table (extension = required; spec-kit CLI, `.specify/` scaffolding, `companion` hook in `.specify/extensions.yml` = optional/situational), prose on extension dispatch vs. terminal spec-kit, the "shared spec files = single source of truth, no ownership conflict" clarification, and an inbound link to `docs/how-it-works.md`.

## Risks

- Wording must stay consistent with the existing "IDE Chat" / "Claude in VS Code" provider notes (one-way dispatch, spec-kit-must-be-initialized) — cross-check those paragraphs so the new section doesn't contradict them.

# Spec: Clarify Setup Components

**Slug**: 125-clarify-setup-components | **Date**: 2026-06-05

## Summary

New users can't tell which pieces of SpecKit Companion are **required** vs **optional**, nor how the VS Code extension relates to the command-line spec-kit process they may already be running. This is a docs-only change that adds a "Setup & Components" section to `README.md` spelling out the required/optional components (extension, spec-kit CLI, `.specify/` scaffolding, the `companion` hook in `.specify/extensions.yml`), how the extension dispatches `/speckit.*` commands relative to running spec-kit from a terminal, and who "owns" the workflow at any moment (extension-dispatched vs. manual CLI). Resolves [#192](https://github.com/alfredoperez/speckit-companion/issues/192).

## Requirements

- **R001** (MUST): README documents each component and labels it **Required** or **Optional**: the extension itself, the spec-kit CLI (`specify`), the `.specify/` scaffolding, and the `companion` entry in `.specify/extensions.yml`.
- **R002** (MUST): README explains that the extension's only runtime coupling to a provider is **dispatching command text** (`/speckit.*` or SDD skill prompts) — it does not require the spec-kit CLI to be installed for the core viewer/comment features, and it never reads CLI responses back.
- **R003** (MUST): README clarifies workflow "ownership" — that the same `.claude/specs/` + `.spec-context.json` files are the single source of truth whether a step was driven by the extension or by spec-kit in a terminal, so the two are interchangeable, not competing.
- **R004** (SHOULD): The new section distinguishes the **two dispatch styles already documented** (terminal CLI providers vs. IDE Chat / Claude in VS Code) without duplicating the provider matrix, linking to the existing "Supported AI Providers" section rather than restating it.
- **R005** (SHOULD): README links to `docs/how-it-works.md` for readers who want the deeper architecture view, since that doc currently has no inbound link from the README.
- **R006** (MAY): A compact table or checklist summarizes Required vs Optional at a glance.

## Scenarios

### New user reading the README before installing

**When** a user lands on the README trying to decide what they must install
**Then** a single "Setup & Components" section tells them the extension is the only hard requirement for the viewer/review features, and the spec-kit CLI + `.specify/` scaffolding are only needed to actually run `/speckit.*` phase commands.

### User already running spec-kit from the terminal

**When** a user who has been running `specify`/`/speckit.*` in a terminal installs the extension and wonders whether the two will conflict
**Then** the README explains they share the same on-disk spec files, so a step can be driven from either surface and the other will reflect it — there is no separate extension-owned state to get out of sync.

### Reader wanting the deep architecture

**When** a reader finishes the setup section and wants implementation detail
**Then** a link points them to `docs/how-it-works.md`.

## Out of Scope

- No code, command, or configuration behavior changes — documentation only.
- No new screenshots (the change is prose/structure; no UI surface changed).
- Rewriting `docs/how-it-works.md` itself (it stays the contributor-facing deep dive; we only link to it).
- Onboarding UI changes inside the extension (e.g. a setup walkthrough panel) — this spec is README guidance only.

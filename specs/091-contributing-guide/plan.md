# Plan: Contributing Guide

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-28

## Approach

Rewrite the existing `CONTRIBUTING.md` and `.github/pull_request_template.md` in place. Anchor the rewrite in the conventions already encoded in `CLAUDE.md` and `README.md` rather than inventing new ones — the goal is to surface the rules contributors are silently expected to follow (Conventional Commit scopes, the README docs map, the F5 dev loop), not add new process.

## Files to Change

### Modify

- `CONTRIBUTING.md` — expand from the current 80-line stub to a full guide: prerequisites, setup with `F5` dev-host, build/watch/package commands, test suite (with BDD style + `tests/__mocks__/vscode.ts` note), Conventional Commit scopes with real examples, link to the README docs map and `docs/` deep references, mention `specs/` as the SDD template directory, mention `npm run install-local`.
- `.github/pull_request_template.md` — extend the existing template: keep the related-issue/description/type-of-change/testing/checklist scaffolding, add a "Updated README per docs map (or N/A)" checkbox, add a "Screenshots / GIFs (UI changes only)" slot, tighten the testing section to reference `npm test`.

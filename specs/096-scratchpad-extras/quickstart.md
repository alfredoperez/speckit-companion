# Quickstart: Per-Document Scratchpad Extras

**Feature**: 096-scratchpad-extras
**Audience**: Developer verifying the implementation in the Extension Dev Host.

## Prerequisites

```bash
npm install
npm run compile      # or: npm run watch
```

Press **F5** in VS Code to launch the Extension Development Host. Open a
workspace that has a spec with at least a `spec.md` (e.g. `specs/<feature>/`).

---

## Story 1 — Capture notes and apply them (P1)

1. Open a spec in the spec viewer; select the **Spec** tab.
2. Confirm a **scratchpad sub-tab** appears in the children rail next to Spec
   (visually distinct from the Spec tab). Click it.
3. If the file is absent, create it (Story 2), then **Edit** it and type a few
   refinement notes (e.g. "Tighten FR-003 wording; clarify the empty-state copy").
4. Back on the scratchpad tab, confirm the **Refine** button is visible/active.
   Click it.
5. **Expect**: the AI CLI receives a direct-edit instruction targeting
   `spec.md` (not a regenerate/template command, no `setup-*.sh`). The scratchpad
   file is left intact.
   - ✅ FR-010, FR-011, SC-002, SC-003
6. Switch to the **Spec** (source) tab. **Expect**: the Refine button is **hidden**.
   - ✅ FR-009, SC-004

---

## Story 2 — Create a scratchpad on demand (P1)

1. Open a spec where `spec-extra.md` does not exist; click the Spec scratchpad
   sub-tab.
2. **Expect**: an empty state with a single create action labeled for the
   specific file (e.g. **"Create spec-extra.md"**).
   - ✅ FR-006
3. Click create. **Expect**: an empty `spec-extra.md` is created in the spec
   directory and the view switches to it.
   - ✅ FR-007, SC-001
4. Use the **Edit** affordance. **Expect**: it opens in the standard VS Code
   editor (same affordance as other documents).
   - ✅ FR-008

---

## Story 3 — See which scratchpads have notes (P2)

1. Add content to one scratchpad; leave another empty/absent.
2. **Expect**: only the scratchpad with content shows the "has notes" indicator
   (dot on its sub-tab); empty/absent ones do not.
   - ✅ FR-016 (may ship after the initial release)

---

## Edge cases

| Case | Action | Expect |
|------|--------|--------|
| Empty apply | Refine on an existing but empty scratchpad | No dispatch; "Nothing to apply" toast (FR-012) |
| Deleted on disk | Delete `plan-extra.md` while its tab is open | Sub-tab returns to empty state on next view |
| Created on disk | Create `tasks-extra.md` directly in the spec dir | Viewer surfaces it as existing, no in-app create needed (FR-017) |
| Source absent | Open a spec with no `plan.md` | No plan scratchpad sub-tab offered |
| Mapping | Refine on `tasks-extra` | Edits `tasks.md` only — never `spec.md`/`plan.md` |

---

## Removal acceptance (FR-015 / SC-005)

Confirm none of the old inline-comment controls are reachable:

- [ ] No hover "+" / comment button appears on lines or scenario rows.
- [ ] No inline comment cards or comment-entry dialog can be opened.
- [ ] The old batch "Refine (N)" submit button is gone.
- [ ] Task checkboxes still toggle (independent feature retained).

---

## Non-core guarantees (FR-013, FR-014, SC-006)

- [ ] Adding/editing a `*-extra.md` does **not** change step badges, phase
      gating, or the task-completion percentage.
- [ ] Creating `tasks-extra.md` does **not** fire a phase-complete notification.
- [ ] `*-extra.md` files appear in `git status` (not ignored).

---

## Automated checks

```bash
npm test         # scanner injection (incl. source-absent skip + on-disk
                 # recognition), create handler, apply empty guard, apply prompt
npm run compile  # type-check the message-union and SpecDocument changes
```

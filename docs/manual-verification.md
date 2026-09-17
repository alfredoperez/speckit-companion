# Manual verification

What a person has to click before a version ships. Everything here is behaviour a test cannot see: whether the panel actually redraws, whether a button lands on the right file, whether a countdown reads right at human speed.

## How to use it

Run the pass on a local install (`/install-local`, then reload the window), against a real project with living specs — this repo works.

Tick a line only after seeing the outcome with your own eyes. A line that fails becomes an issue with what you saw, not a note in this file: this file says what to check, the tracker says what is wrong. When a release ships, clear the per-release section and start the next one; the standing checks stay.

## Standing checks

Run these every release, whatever changed.

- The extension activates on a fresh window with no errors in the Extension Host log.
- The Specs sidebar lists this project's specs, and clicking one opens the viewer on its Overview.
- The Living Specs sidebar lists capabilities with their coverage and drift notes.
- A spec's Spec, Plan and Tasks tabs each render their document.
- The Overview's timeline shows the run's phases with real durations.

## Unreleased — since v0.33.0

### Reviewing a living spec (#744, PR #746)

**Approve all, and undo it**

- A living spec with adopted requirements shows `Approve all N` in the bottom bar, counting the adopted ones.
- The header carries no approve button any more.
- Pressing it clears every adopted mark and the draft banner in one go, and the DRAFT badge goes with them.
- `Undo` appears for 5 seconds with a visible countdown, and the file comes back exactly as it was.
- Letting the 5 seconds pass removes the Undo without changing anything further.
- Pressing Escape while the Undo is showing does nothing — Escape still belongs to an inline edit.
- On a capability with nothing adopted, no approve action is offered.

**Remove, and the record it leaves**

- Remove on a card asks for confirmation, then deletes that requirement and its scenarios.
- Undo within 5 seconds restores the file, and no `.spec-context.json` appears beside the spec.
- Removing again and waiting past 5 seconds writes one `requirement-removed` line into the `.spec-context.json` beside that spec, naming the capability and the requirement.
- Removing a requirement that another capability's spec aligns to is refused, and the message names that capability.
- Removing one that only its own spec points at, including a self-link, is allowed.

**New on this branch**

- On a branch that added a requirement to a spec that exists on `main`, that card gets a green edge and a `New` pill, and the header reads `N new`.
- A requirement whose body changed but whose heading did not is *not* marked new.
- A spec that `main` does not have at all marks nothing.
- The spec file on disk is unchanged after the marks appear.

**Leans on and leaned on by**

- A card with an `aligns` marker lists `Leans on` under its files.
- The requirement it points at lists it back under `Leaned on by`.
- Clicking a resolved entry opens that capability scrolled to that requirement.
- A marker naming a capability or heading that does not exist shows as a broken link with its original text, and clicking it does nothing.
- A card with no links either way shows neither list.

**Open from anywhere**

- `SpecKit: Open Living Spec` lists every registered capability.
- Picking one lists its requirements plus `Open at the top`.
- Picking a requirement opens the viewer scrolled to it; picking `Open at the top` opens at the top.
- Dismissing either picker opens nothing.
- The Living Specs tree row and the status bar item still open the same way.

### Coverage table reads its tests (PR #746)

- A finished spec's Overview shows the tests beside each requirement instead of `No test linked`.
- A requirement that genuinely has no test still says so.
- A spec completed before this release also shows its tests, without being rewritten.

## Related

- `docs/doc-sync.md` — the per-release documentation checklist this pass runs beside.
- `docs/viewer-states.md` — what each viewer state is supposed to look like.

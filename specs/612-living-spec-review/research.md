# Research: Reviewing a living spec

Each decision names the capability it belongs to, so the fold knows where it lands.

## 1. Undo lives on the panel in the extension

**Capability**: spec-viewer-living

**Decision**: the panel's state in `specViewerProvider.ts` holds one pending undo: the file text before the action, the text written, the action kind, and the removed heading if any. `NavState.livingUndo` tells the webview a token and when it expires. `LivingFooter` renders the existing `UndoToast` for the remaining time. Undo compares the file on disk with the text written. When they differ it writes nothing and warns that the file changed.

**Rationale**: every Approve, Remove and file watch regenerates the webview page, so state held only in the webview is wiped by the very write it would undo. Comparing text instead of modification time is exact and needs no extra stat. `builderPanel.ts` already holds one pending undo per panel the same way, and a new action replaces the old one, which is what the spec's edge case asks for.

**Alternatives considered**: undo state in the webview, lost on the first re-render. A stack of undos, which the spec rules out.

## 2. The removal record is appended to a `.spec-context.json` beside the capability's spec

**Capability**: spec-viewer-living (writer), capture-runtime-living-resolve (reader)

**Decision**: when a removal stands, meaning the timer ran out, a newer action replaced it, the panel closed or it re-anchored, `appendLivingRemoval` appends `{ kind: "requirement-removed", capability, requirement, at, by: "user" }` to `history[]` in the `.spec-context.json` in the spec file's directory. It creates the file when absent. It reads, merges and writes this file directly, not through `updateSpecContext`, because that writer stamps feature-spec defaults (`status`, `currentStep`, `workflow`) that a capability does not have. Every record names its capability, because colocated capabilities share a directory and therefore the file.

**Rationale**: the spec pins the location. A `history[]` entry follows the project's append-only schema, and naming the capability makes a shared file unambiguous.

**Alternatives considered**: a marker line inside the spec file, which would dirty the file after the Undo window closed. A key in `living-specs.yml`, which is registry-owned and rewritten by other tools. Going through `updateSpecContext`, which would make the file look like a feature spec.

## 3. Links come from one in-process function over the requirement slicer

**Capability**: specs-living-model

**Decision**: `requirementLinks(root, capability)` in `livingSpecsModel.ts` reads every registered capability's spec with `requirementSlices`. For each requirement it returns Leans on (its own aligns, each marked resolved or broken) and Leaned on by (requirements in other capabilities whose aligns name it). Headings match exactly, like the Python resolver. The living state builder puts the result on `LivingOverview.requirements`. `handleLivingRemove` uses the same Leaned on by for its refusal, and the loose `alignsIn` in `livingDocs.ts` is deleted.

**Rationale**: `alignsIn` matched markers anywhere in a file, including inside code fences and prose, so the refusal and the cards could disagree. One function gives both the same answer. Reading spec files is local and needs no tooling, so it belongs on first paint, not in the slow push. Leaned on by excludes the requirement's own capability, as FR-007 and the existing refusal rule both say, so a self-link no longer blocks Remove.

**Alternatives considered**: shelling out to the resolver's `--leaned-on-by`, which the model spec forbids for the editor. Computing links in the slow push, which delays a fact that needs no git.

## 4. New marks ride the post-paint health push

**Capability**: spec-viewer-living (push), specs-living-model (git read)

**Decision**: `readMainCopy(root, relPath, { git })` sits beside `makeDefaultGitRunner` in `livingSpecsModel.ts`, runs `git show main:<path>` under the same 1500 ms timeout, and returns `undefined` on any failure. `resolveLivingHealth` sets `newRequirements` to the working-copy headings that `main`'s slices lack, or leaves it absent when the read failed. A file missing on `main` reads as a failure, so no card is marked. The webview keeps a module-level set through `setLivingNew`, the same pattern as `setLivingDrifted`, and re-renders when it changes.

**Rationale**: git can be slow or absent. The slow-fact path already races a timeout and drops results for a panel that moved on. The spec keeps a file that `main` lacks unmarked, so the failure and the missing-file cases share one branch.

**Alternatives considered**: `git diff` parsing, which is heavier and reports body edits the spec excludes. Computing on first paint, which blocks the render on git.

## 5. New is its own attribute, not a card state

**Capability**: viewer-ui-document

**Decision**: a new card carries `data-req-new` and a New pill beside its state pill. The existing `_living.css` rule keyed on `data-req-state="new"` moves to `[data-req-new]`. A card that is both drifted and new keeps the drifted edge and shows both pills.

**Rationale**: `data-req-state` is single-valued, so a new drifted card would lose one fact. Drift asks for action, so it keeps the edge.

**Alternatives considered**: a combined `new-drifted` state, which multiplies CSS rules for each combination.

## 6. Approve all moves from the header to the bar

**Capability**: viewer-ui-chrome

**Decision**: `ApproveSpecButton` leaves `SpecHeader.tsx`. `LivingFooter.tsx` shows `Approve all N` when the overview has N ≥ 1 adopted requirements, and posts the existing `approveSpec` message. The header keeps the adopted count and gains "N new".

**Rationale**: two buttons for one action split the reader's attention. The bar is where the spec puts it, next to Undo.

**Alternatives considered**: keeping both, which duplicates the action.

## 7. The resolver answers `--leaned-on-by`, and the validator honors removal records

**Capability**: capture-runtime-living-resolve

**Decision**: `resolve-spec-paths.py` accepts `--leaned-on-by <capability>#<heading>` and returns `{"show": "leaned-on-by", "target", "matches": [{capability, heading, touches, body}]}`, including requirements in the same capability, as FR-009 says "every". It also gains `removed_requirements(spec_path, capability)`, which reads the records from decision 2. `living_validate.py` skips `delta-heading-not-found` for a heading with a record. Drift and the doctor have no missing-requirement check today, so FR-011 holds for them without a change. A test pins the validator skip.

**Rationale**: the resolver is the single reader of the registry, so the record reader belongs beside it. The validator is the only place a deliberately removed heading can raise a false alarm.

**Alternatives considered**: adding a new missing-requirement check to the doctor only to exempt removals from it, which builds a check nobody asked for.

## 8. The new command and the entry points

**Capability**: specs-living-view

**Decision**: `speckit.livingSpecs.open`, titled `Open Living Spec` in the SpecKit category, is registered in `livingSpecsCommands.ts`. The title has no trailing ellipsis because the spec pins `SpecKit: Open Living Spec`. It lists `readLivingSpecs(root, { withOrphans: false })` capabilities, then that spec's `requirementSlices` headings plus an "Open at the top" item. It calls `speckit.viewSpecDocument` with `{ living: true, requirement? }`. When the listing is not configured or disabled, it shows an information message and opens nothing. The status bar already passes a requirement. The tree row and the run-log chips name no requirement, so they keep opening at the top through the same command. A test pins each entry point's arguments.

**Rationale**: one open path means one scroll behavior. An unknown heading is already a silent no-op in `toc.ts`.

**Alternatives considered**: requirement child rows in the tree, which add a tree level the spec does not ask for.

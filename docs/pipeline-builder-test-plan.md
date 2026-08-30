# Pipeline Builder — manual test plan

Every thing the panel can do, run by hand, in an order that builds on itself. Tick as you go; anything that fails, tell me the section number and what you saw.

The last section is the one that matters: build the pipeline you just customised and run a real spec through it. Everything before it is setup for that.

---

## 0. Before you start

### 0.1 A sandbox, not this repo

Customising writes to `.specify/companion.yml` and `.specify/companion/nodes/`. Do it somewhere throwaway.

```bash
mkdir -p ~/dev/sandbox/builder-qa && cd ~/dev/sandbox/builder-qa
git init -q -b main
specify init --here --integration claude --force
specify extension add ~/dev/GitHub/speckit-companion/speckit-extension --dev --force
code .
```

- [ ] `.specify/` exists with `templates/`, `memory/`, `extensions/companion/`
- [ ] A trivial source file to implement against — e.g. `echo 'export const todos = [];' > app.js`

### 0.2 Fixtures to customise with

The panel lets you attach four kinds of hook and replace nodes with your own. Three of the four need something to point at, so make them first.

**A skill** — `.claude/skills/house-check/SKILL.md`:

```markdown
---
name: house-check
description: Check a spec against this team's house rules.
---
Append one line reading `house-check ran` to HOUSE-LOG.md at the repo root.
Then state which house rules the spec follows.
```

**A node of your own** — `.specify/companion/nodes/house-review.md`:

```markdown
---
id: house-review
---
Re-read what you just wrote against the house style guide before continuing.
```

**A shell command** that leaves a trace: `echo shell-hook-ran >> HOOK-LOG.md`

- [ ] All three exist

### 0.3 Known gap — there is no library of alternatives

You asked which alternative nodes we provide. **We provide none.** Every step ships exactly one implementation of each node:

| Step | Nodes |
|---|---|
| specify | resolve-dir, load-living-specs, draft-spec, quality-checklist, classify-size, persist-size, branch, finalize, handoff |
| plan | size-budget, gather-context, plan-doc, constitution-check, side-files, handoff |
| tasks | size-budget, tasks-doc, review-gaps, handoff |
| implement | implement-exec, complete, handoff |
| auto | resolve-dir, orchestrate, handoff |

"Replace a node" therefore means **write your own file**, not "pick a different one from a list". There is no menu to choose from, and §6 tests it that way.

The closest thing to a library is `speckit-extension/examples/ship-ticket/`, which ships five real node files (`review`, `copilot`, `pr`, `merge`, `install-local`) and two example configs. Copy those into the sandbox if you want realistic material.

**If you want a genuine alternatives library — two `draft-spec` variants, a lighter `tasks-doc`, and so on — that is unbuilt work and needs scoping before it can be tested.** Decide that before §6.

---

## 1. Opening the panel

- Command Palette → **SpecKit: Open Pipeline Builder**

- [ ] Panel opens
- [ ] Header reads **Pipeline**, then **This project**, then a chip saying **Shipped default · no changes**
- [ ] Counts read `4 steps · … phases · … nodes · 0 hooks`
- [ ] Steps are columns left to right: specify, plan, tasks, implement — numbered 1–4
- [ ] `auto` sits **above** the row, not as a fifth column
- [ ] Every step shows named phases (gather, author, …) with nodes inside them
- [ ] Run it again — it reveals the same panel rather than opening a second

## 2. Reading a node

- Click any node name, e.g. **Draft the spec**

- [ ] A side panel opens with its instructions rendered — no frontmatter, no empty `<!-- -->` fences
- [ ] Shared blocks are **named** rather than shown as empty comments
- [ ] The node you opened is marked on the canvas
- [ ] `Needs` / `Writes` / `Source` read correctly
- [ ] **Open the file** opens the real `.md` in an editor tab
- Click the **step's name** (`specify`)
- [ ] The step's own preamble opens, described as the step's instructions
- [ ] **Close** (×) shuts the side panel

## 3. Editing a node — this is what makes it yours

- Open **Draft the spec** → click **Edit what it tells the assistant**

- [ ] A textarea appears seeded with the stored text, **fences intact**
- Add a line: `Add a final section headed "## House Rules Applied".`
- [ ] **Save** writes `.specify/companion/nodes/specify/draft-spec.md`
- [ ] The node is now marked as yours on the canvas (the "yours" hue)
- [ ] The shipped file under `speckit-extension/nodes/` is **untouched**
- [ ] The saved file kept its `id:`, `kind:`, `writes:` metadata
- [ ] Header chip now says the project is customised
- [ ] **Use the shipped node** gives it back and the mark disappears
- [ ] Re-do the edit — you need it for §10

## 4. Reordering nodes

- Drag **Gather context** above **Apply the size budget** in `plan`

- [ ] The node has a drag grip and moves
- [ ] The new order sticks after the panel redraws
- Try dragging **Hand off to the next step** anywhere but last
- [ ] It is refused, with a notice saying the handoff must run last
- [ ] The lane snaps back rather than showing the move that did not happen
- [ ] A pinned node shows **why** it cannot move on hover

## 5. Phases

- [ ] **Rename** — click a phase name, type a new one, it saves
- [ ] Renaming a phase that has hooks keeps those hooks attached to it
- [ ] **Move a node** — drag it into another phase; both phases update
- [ ] **Merge** (−) folds a phase into its neighbour rather than dropping its nodes
- [ ] The **only** phase in a step offers no merge
- [ ] **Split** divides a phase in two
- [ ] A phase with one node offers no split
- [ ] Emptying a phase is impossible — there is no state where a phase has nothing in it

## 6. Replacing things

- [ ] **Dropped node** — after a recipe drops one, it is offered by name and can be put back into a phase you pick
- [ ] Putting it back restores both its order and its phase
- On a step header, click **Make it ours**
- [ ] It writes one document seeded with everything that step currently says — frame plus every node
- [ ] The step now shows that single node and nothing else
- [ ] The file opens for editing
- [ ] Doing it twice does **not** overwrite your edits

## 7. Hooks — all four kinds

Click a **+** seam, or **Add hook** on a phase.

- [ ] The form opens **in the panel**, not as a VS Code pop-up
- [ ] It names the anchor it will attach to

**Shell command**
- [ ] Type `echo shell-hook-ran >> HOOK-LOG.md`, save; it appears at that boundary
- [ ] A long command shows shortened, with the full text on hover

**Prompt**
- [ ] Free text saves and reads back as an instruction

**Skill**
- [ ] The field **offers** `house-check` rather than asking you to remember it
- [ ] The optional extra line saves too

**Node**
- [ ] The field offers `house-review`
- [ ] It renders as that node's text inlined at the anchor

**Editing and removing**
- [ ] Clicking a hook opens it filled in
- [ ] Clicking hook A then hook B shows **B's** values, not A's
- [ ] Saving replaces that hook rather than adding a second
- [ ] **Remove** takes it out; the others keep their order
- [ ] Removing the last hook at an anchor returns it to an empty seam
- [ ] A hook on a **phase** attaches to the phase, not to a node
- [ ] Before-hooks draw above their anchor, after-hooks below

## 8. Stock spec-kit hooks

- [ ] Hooks from `.specify/extensions.yml` appear under the step they fire on
- [ ] They say which extension registered them
- [ ] They are visibly **not yours** — different from the "yours" hue
- [ ] They are not editable here

## 9. Workflows

- [ ] The header names the workflow in force
- [ ] **New workflow** creates one and opens it
- [ ] Switching workflows changes what the panel draws
- [ ] Switching to **shipped** drops your customisations from view but keeps the workflow file
- [ ] Switching back restores them

## 10. Build

- [ ] **Preview** shows what would change and writes nothing
- [ ] **Build** runs; the panel shows busy, then settles
- [ ] The header stops saying the build is behind
- [ ] `.specify/extensions/companion/commands/speckit.companion.specify.md` contains your edited node text
- [ ] It contains your hooks at the right boundaries
- [ ] Phase markers show your phase names in your order

## 11. Recovering from a broken configuration

Break it by hand — open `.specify/companion.yml` and empty a phase's `nodes:`:

```yaml
      - name: "gather"
        nodes:
```

- [ ] The panel says it could not read the pipeline
- [ ] It offers **ways out as buttons**, not just "open the file"
- [ ] The narrowest repair is listed first, and each says what it costs
- [ ] The broadest one reads as destructive
- [ ] Applying the narrow one makes the panel read again
- [ ] Your hooks and edits **survived** the repair
- [ ] **Open companion.yml** is still there, smaller
- [ ] Fixing the file by hand refreshes the panel on save

## 12. The panel at other sizes

- [ ] Drag the panel narrow (side-panel width) — the header wraps, nothing is cut off
- [ ] The side panel stacks below rather than keeping full width
- [ ] Lanes scroll sideways rather than squeezing
- [ ] Switch VS Code to a **light** theme — everything stays legible

---

## 13. The real test — run a spec through what you built

This is what the rest was for. Tell me when you reach here and I will run it and report.

- Make sure your sandbox has: the edited `draft-spec`, the `house-check` skill hook, the shell hook, and a renamed phase.

- [ ] **Build** the pipeline
- [ ] Run `/speckit.companion.specify` with: *"Let a reader mark any todo as starred, and add a Starred filter to the list view."*

Then check:

- [ ] `specs/<n>-<name>/spec.md` exists with numbered requirements
- [ ] `HOUSE-LOG.md` exists — proves the **skill hook** fired
- [ ] `HOOK-LOG.md` exists — proves the **shell hook** fired
- [ ] `spec.md` contains `## House Rules Applied` — proves your **edited node** was followed, not the shipped one
- [ ] `.spec-context.json` recorded the step with real timestamps
- [ ] The run stopped where your pipeline says it should

---

## Reporting back

For anything that fails, tell me:

1. The section number
2. What you did
3. What happened instead

Sections 3, 6, 7 and 13 are the ones I would most expect to find something in — they are the newest, and 13 is the only one where a customisation has to survive an actual run.

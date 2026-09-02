# The Pipeline Builder

Your assistant runs a pipeline: four steps, each assembled from blocks of instruction. The builder shows you that pipeline and lets you change it — swap a block for a different one, attach your own work at any boundary, change the shape of the documents a step writes, add a step of your own — without forking anything.

Open it from the **circuit** icon at the top of the Specs sidebar, or from the palette: **SpecKit: Open Pipeline Builder**.

> Every image below is generated from the panel's own stories by `scripts/capture-docs-images.mjs`. They are build artifacts — regenerate with `node scripts/capture-docs-images.mjs --only builder-`, never hand-edit.

---

## What you are looking at

![The pipeline builder, showing four steps as columns with their phases, nodes and attached hooks](screenshots/generated/builder-board.png)

The run reads left to right — **specify, plan, tasks, implement** — because that is the order it happens in. Inside each step:

- **Phases** are the bands (`GATHER`, `AUTHOR`, `WRAP-UP`). A phase groups nodes and gives work a coarser place to attach than a single node.
- **Nodes** are the cards. Each one is a block of instruction the assistant reads. The green text under a name is what that node produces.
- **Hooks** are work you attached, drawn under the block they run against.

Anything the project changed carries one colour, and nothing else does — so *"what did we change here"* is answerable without reading. The dot beside a step name means that step differs from the shipped pipeline; hover it for what changed.

At the far right, **Outside the run** holds what does not take a turn: `auto`, which runs the other steps hands-off, and the invitation to add a step of your own.

The header carries the one fact you cannot get by looking: how many hooks are attached across the whole board, and how many of them are yours.

### A step, close up

![A step header showing its name, node count, artifact count and template chip, above its phases](screenshots/generated/builder-step.png)

The name is the step. Under it, quietly: how many nodes it runs, how many files a run of it produces (hover for their names), and **§** — the template it writes into, which you can change.

Click the step's name to read its own instructions: the preamble every node in it sits under.

---

## Reading a block

Click any node.

![The side panel showing one node's rendered instructions, with what it needs, what it writes, and whether it can move](screenshots/generated/builder-read-block.png)

The panel renders what that block actually tells the assistant — no frontmatter, no empty comment fences, and shared blocks named rather than shown as blanks. Beside it:

| | |
|---|---|
| **Writes** | the files this block produces |
| **Needs** | the blocks that must have run first |
| **Order** | whether it can be dragged, and what is holding it if not |
| **Source** | whether it ships with Companion or is yours |

**Open the file** is still there for when the editor is what you wanted.

### Making it yours

**Edit** opens the instructions in a textarea. Saving writes `.specify/companion/nodes/<step>/<node>.md`, and from then on your version is what the assistant reads. The shipped file is never touched, so an upgrade neither overwrites your copy nor silently reverts it. **Use the shipped node** hands it back.

---

## Running a different block

Some blocks have alternatives — same place in the run, different instructions. They show a **Replace** menu.

![The Replace menu open, offering two alternatives with a line describing each](screenshots/generated/builder-replace.png)

Picking one is the same write a drag makes: the block stays editable, and one click from the shipped one. Anything you attached to the block you replaced comes with it.

Shipped alternatives today:

| Step | Instead of | You can run |
|---|---|---|
| specify | Draft the spec | **as a delta** — only what changes, for a system that already exists |
| specify | Draft the spec | **as a fix contract** — defect, expected, and what must not change |
| specify | Quality checklist | **blocking** — loops, then stops and asks |
| specify | Resolve the spec folder | **on a branch** — numbered against every branch, not just what is on disk |

## Adding a block a step ships but does not run

Some blocks ship with a step and are not part of the default run. The **+ node** picker on a phase offers them, alongside anything the project dropped.

![The + node menu open, offering a shipped add-on and a node the project removed, each with a line saying which it is](screenshots/generated/builder-add-node.png)

Each option says what it is, so you are not picking from bare identifiers:

| Step | Add-on | What it does |
|---|---|---|
| tasks | `review-gaps` | attacks the task list before it runs — the destructive and edge-case interactions a lean spec under-specifies |
| implement | `verify-manually` | stops and has a person open the thing before the step counts as done |

---

## Changing what a step writes

The **§** chip on a step opens the shape of the document it produces.

![The template panel, one row per section of the document, each offering the alternatives written for it](screenshots/generated/builder-template.png)

One row per `##` section the template has. Each offers the fragments written for that section, plus **As it ships**. Restoring a section removes the entry rather than writing "shipped", because an absent entry already means the template's own words.

Shipped fragments:

| For | Section | Instead gives you |
|---|---|---|
| specify | User Scenarios & Testing | observable **outcomes**, numbered **EARS requirements** (WHEN/THEN/SHALL), or stock spec-kit's **prioritized stories** |
| plan | Technical Context | stock spec-kit's full stack block |
| tasks | Format / Notes | self-verifying tasks, coding-only tasks, or a demo line per task |

A reshaped document is one the command tells the assistant to follow — a step you left alone is byte-identical to the shipped one.

---

## Attaching your own work

Work can be attached at any boundary: before or after a node, a phase, or a whole step.

![A node with hooks attached, grouped under one HOOKS heading with before and after named in words](screenshots/generated/builder-hooks.png)

Everything attached to one anchor sits in one block, with the two sides named. Your own hooks carry the "yours" colour; hooks an installed spec-kit extension registers sit in the same place and the same shape, in a quieter one. Those run too — this panel shows them but does not edit them.

**Add hook** on any phase, or the seam between two nodes, opens the form.

![The Add hook form, offering a skill, an instruction, a command or one of your nodes](screenshots/generated/builder-attach.png)

Four kinds:

| | |
|---|---|
| **Run a skill you already have** | The instructions stay in the skill, so editing it later changes what runs. Reach for this first. |
| **Say something to the assistant** | One instruction, kept in `companion.yml`. |
| **Run a command** | A shell line. The assistant needs a terminal for this one. |
| **Include one of your nodes** | A file from `.specify/companion/nodes/`, reusable in more than one place. |

Click a hook that is already there to change it or take it out.

---

## Several ways of working

A **workflow** is a whole named configuration. Switching between them swaps everything at once — node order, hooks, templates, routing — so a one-line fix and a client deliverable can run different pipelines out of one repository. Your nodes and fragments are shared across all of them.

![The New workflow form, offering two shipped configurations to start from](screenshots/generated/builder-preset.png)

A new workflow starts from what you run today, from the pipeline as it ships, or from one Companion ships:

| Preset | For |
|---|---|
| **Classic spec-kit** | Stock spec-kit's document shapes — prioritized P1/P2/P3 user stories, the full Technical Context block. Changes what the documents look like, not what the run does. |
| **Brownfield** | Changing a system that already exists: the spec written as a delta, the folder numbered against every branch, the task list attacked before it runs, and a person opening the thing before it counts as done. |

Whichever you pick is copied in and yours to change from there. A preset is a start, not a fixed thing.

---

## Adding a step of your own

The set of steps used to be fixed, so *"review the change before it counts as done"* had to hide inside implement or not exist. **+ step**, at the end of the row, gives the run a turn it did not have.

![The New step form, asking for a name, a label, where it runs and what it writes](screenshots/generated/builder-new-step.png)

Name it, say where it runs and what it produces. The panel writes `.specify/companion/nodes/<name>/` seeded runnable — a frame, an order file, and one node to edit — and opens that node.

![A step the project added, drawn between implement and the end of the run](screenshots/generated/builder-own-step.png)

Where it runs is one key in its own order file:

```yaml
# Omit this line for a step you launch when you want it.
after: implement
```

With `after:`, it takes its turn in the run and is drawn between the two steps it sits between. Without one, it is drawn under **Outside the run** — available, not part of the sequence.

Everything else works like a shipped step: add and replace blocks, name its phases, attach hooks, edit its frame. The build gives it a real agent command, so your assistant can dispatch `/speckit.companion.<name>` after the next build.

---

## Building

Nothing you change takes effect until you build. Configuration is the source of truth; the commands your assistant reads are derived from it.

![The header saying the build is behind the configuration](screenshots/generated/builder-stale.png)

**Preview** shows what would change and writes nothing. **Build** applies it: it resolves which nodes each step runs, splices in your hooks, resolves any template you reshaped, writes the command bodies with a manifest beside them — and carries them out to the copies your assistant actually loads.

A build that cannot finish says which step and why, and leaves the working pipeline exactly as it was.

---

## When the panel cannot read your pipeline

A configuration outside the readable subset — a phase with nothing in it, a node that names something that does not exist — stops the panel drawing. It says so, and offers the ways out as buttons rather than telling you to open a file: the narrowest repair first, each saying what it costs, the broadest one reading as destructive. Your hooks survive every one of them.

**Open companion.yml** is always there, and the panel refreshes when you save it.

---

## Where everything lives

| | |
|---|---|
| `.specify/companion.yml` | your configuration — the source of truth |
| `.specify/companion/workflows/<name>.yml` | a whole named configuration you can switch to |
| `.specify/companion/nodes/<step>/<node>.md` | a block you rewrote, or a step you added |
| `.specify/companion/fragments/<name>.md` | a document section you wrote |
| `.specify/extensions/companion/commands/` | what a build produces — derived, not edited |

The reference for the configuration format is [`docs/template-profiles.md`](./template-profiles.md).

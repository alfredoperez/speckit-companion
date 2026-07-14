# Spec Viewer Redesign Investigation

You are an AI provider running a design investigation on the SpecKit Companion spec viewer. Several providers run this same brief independently; the results are compared side by side in one Storybook. Replace `<Provider>` with your name everywhere it appears (e.g. `Claude`, `Codex`), and use its lowercase form for folders (`claude`, `codex`).

## Mission

The spec viewer is the webview that renders a spec's documents (spec.md, plan.md, tasks.md, research, data-model, checklists, contracts) with a step pipeline, header, table of contents, activity panel, and footer actions. It works, but it grew feature by feature. Your job is to propose — as working Storybook stories, not slideware — answers to five design questions:

1. **Own theme?** Today every color derives from VS Code theme variables with fallback chains. Is the viewer better served by its own designed theme (light + dark) that only *anchors* on VS Code colors?
2. **Component library?** Should the viewer's UI grow into a small owned component library, using the existing "Techy" explorations as a seed direction?
3. **Navigation & shell?** Redesign the step pipeline, sub-document rail, and footer CTA buttons. Could the Activity panel be the *main* view instead of a hidden toggle?
4. **Data display?** Is there a better way to render the data types specs are made of — tables, file references, checklists, tasks, sections, and composed structures like user stories, requirements, decisions?
5. **Space & layout?** Can spacing, density, column widths, and reading measure be controlled more deliberately? (Look at the dead gutter between the TOC and content, the uncontained content width, header/nav vertical rhythm.)

## Rules of engagement (hard rules)

- Create files **only** under `webview/src/spec-viewer/__redesign__/<provider>/`. **Never edit any existing file** — not `tokens.css`, not `.storybook/preview.tsx`, not any component. Another provider is working in this repo at the same time; additive-only is what keeps you from colliding.
- Story titles must start with `Redesign/<Provider>/` (e.g. `title: 'Redesign/Claude/Full Viewer'`). That's how the sidebar groups the competing proposals.
- Every story must be presentable in **both themes** via the existing toolbar switcher (paintbrush icon: "Bearded Monokai Black" / "Bearded Vivid Light"). A proposal that only works on dark is incomplete.
- Respect `prefers-reduced-motion` in any animation you add (the repo already has a global kill-switch in `tokens.css`, but don't rely on transforms that break without it).
- `npm run build-storybook` must pass when you're done.

## Getting around

```bash
npm install        # if needed
npm run storybook  # → http://localhost:6006
```

Key stories to study first (URLs assume port 6006):

| What | URL path |
|------|----------|
| Full viewer, real completed spec (392) | `/?path=/story/viewer-full-viewer--living-specs-viewer-392` |
| Full viewer, bigger real spec (172) | `/?path=/story/viewer-full-viewer--composable-command-nodes-172` |
| Full viewer, in-flight implement state | `/?path=/story/viewer-full-viewer--implementing-172` |
| Techy button explorations | `/?path=/story/experiments-techy-buttons--variants` |
| Techy card explorations | `/?path=/story/experiments-techy-cards--current-vs-terminal` |
| Status lifecycle walk-through | `/?path=/story/viewer-transitions--specifying` (walk the sidebar down) |
| Existing primitive components | `/?path=/story/primitives-button--all-variants` |

The Full Viewer stories are **interactive**: click the step tabs (Specification / Plan / Tasks) and the sub-document rail chips (Research, Data Model, Quickstart, Checklist, Contracts) to switch documents; click **Activity** (top right) to see the recorded run history. Press `S` to collapse the Storybook sidebar — the TOC hides itself when the content pane is narrower than ~780px (`--toc-min-width`).

## Current implementation map

**Shell** — `webview/src/spec-viewer/App.tsx` renders, top to bottom: `NavigationBar` (step tabs + sub-doc rail + Activity toggle) → `StaleBanner` → `SpecHeader` (title, status badge, branch, date) → `<main class="content-area">` containing `#markdown-content` (rendered doc), the lazily-mounted `ActivityPanel`, and the `.spec-toc` aside → `FooterActions` (CTA buttons). State flows through `@preact/signals` in `signals.ts` (`navState`, `viewerState`, `markdownHtml`, `activityVisible`, `historyEntries`).

**Activity panel** — `components/ActivityPanel.tsx`: hero strip with donut + stat chips (`ActivityHero`), always-visible intent/context/expectations (`PlanSection`), then a segmented tablist (`ActivityTabs`) mapping tabs → cards: decisions → `DecisionsCard`; work → `PhasesCard`+`TasksCard`+`FilesCard`; proof → `VerifiedCard`+`CoverageCard`; notes → `ConcernsCard`+`CommentsCard`+`LivingSpecsCard`. It is a **peer region** of the markdown content: `App.tsx` hides `#markdown-content` and the TOC when `activityVisible` is true and shows the panel instead. "Activity as the main view" is therefore mostly a question of default state and layout, not plumbing.

**Navigation messages** — step tabs post `{ type: 'stepperClick', phase }`, sub-doc chips post `{ type: 'switchDocument', documentType }` (`components/NavigationBar.tsx`). In the shipped extension, step clicks currently **regenerate the entire webview HTML** while sub-doc switches swap content client-side; a planned SPA change routes everything through the client-side swap — design your navigation as if switching is instant and animatable.

**Tokens** — `webview/styles/tokens.css` is the single token source: type scale (`--text-xs…3xl`, minor third), spacing (`--space-1…8`, 4→48px), backgrounds/text/accent/status/border families derived from `--vscode-*` variables (many via `color-mix`), radii forced to 2px repo-wide (`--radius-sm/md/lg`, "terminal/techy direction", see `docs/DESIGN.md`), shadows, 150/200/300ms transition durations, and `body.vscode-light` / `body.vscode-dark` / `body.vscode-high-contrast` override blocks. Some values are **self-owned literals**, not theme-derived: `--text-body` (`#d0d0d0` dark / `#4a4a4a` light), the review purple `--review: #a855f7`, all seven `--code-*` syntax colors, and the `'Geist'` font that leads `--font-family`.

**Viewer CSS** — modular partials in `webview/styles/spec-viewer/` (`_navigation.css`, `_content.css`, `_toc.css`, `_activity.css` — the largest at ~29KB — `_requirements.css`, `_task-phases.css`, `_tasks.css`, `_callouts.css`, `_code.css`, `_tables.css`, `_artifacts.css`, `_animations.css`), all imported once via `index.css`, which Storybook loads globally.

**Markdown pipeline** — `markdown/renderer.ts` + `markdown/preprocessors.ts` turn spec markdown into structured HTML with stable class names. These are your restyling hooks:

| Content type | Emitted classes |
|---|---|
| Spec metadata bar | `.spec-meta`, `.meta-item`, `.meta-status.meta-status-<status>`, `.meta-branch` |
| User stories | `.user-story-header`, `.user-story-meta`, `.story-id`, `.story-priority.priority-<p>`, `.user-story-title` |
| Task phases | `.phase-header[data-phase]`, `.phase-num`, `.phase-chip.mvp`, `.phase-title` |
| Requirements (FR/NFR/SC) | `.req-row[data-kind]`, `.req-badge`, `.req-text` |
| Key entities | `.entity-row`, `.entity-name`, `.entity-desc` |
| Checklists | `.ck-group`, `.ck-group-head`, `.ck-item(.ok)`, `.ck-box`, `.ck-text` |
| Technical Context (plan) | `.md-collapsible`, `.tech-grid`, `.tech-cell`, `.tech-key`, `.tech-val` |
| Constitution Check | `.con-row`, `.verdict.pass/.fail`, `.con-name` |
| Research decisions | `.decision-card`, `.decision-num`, `.decision-title`, `.decision-field`, `.decision-val` |
| Callouts (Note/Warning/Critical + GitHub alerts) | `.callout.callout-<type>`, `.callout-icon`, `.callout-label` |
| Tables | plain `<table>` (see `_tables.css`) |
| Code / mermaid / tree | `pre.code-block[data-lang]`, `.mermaid-container`, `pre.tree-structure` |
| Task lines (tasks.md) | `.task-item__did`, `.task-item__files`, `.task-details` |
| Commentable lines | `.line`, `.line-add-btn`, `.line-content` |

**The Techy direction** — `TechyButtons.stories.tsx` and `TechyCards.stories.tsx` (titles `Experiments/…`) are pure explorations, unused in production: monospace, squared 2px corners, hairline borders that flip to the accent on hover, viewfinder corner brackets, uppercase letter-spaced labels. TechyCards shows the pattern of restyling the *real* emitted classes through a wrapper skin class + inline `<style>` — steal that mechanic.

## Evidence: what's already known to be broken or weak

- **Theme fragility (Q1).** Tokens resolve `var(--vscode-*)` fallback chains at `:root`; when a host doesn't define a variable, the fallback silently wins — the light theme shipped for a while with near-white headings on white because of exactly this class of failure. Self-owned literals (`--text-body`, syntax colors) sit outside the theme derivation entirely.
- **Code blocks are dark-only.** The viewer hard-loads highlight.js's `github-dark` stylesheet regardless of theme, so code blocks in light mode are a dark island (visible today in the light theme stories).
- **Light-mode contrast bugs.** In light theme the *active* sub-document tab renders lighter than inactive ones (looks disabled), and several muted-text usages hover near the contrast floor. Check anything you design at WCAG AA in both themes.
- **Layout is under-controlled (Q5).** The TOC column and content column don't share a deliberate grid — there's a large dead gutter between them at wide widths, and the content column has no max reading measure.
- **View vs. status is conflated (Q3).** A step tab today tries to express both "you are looking at this document" and "this pipeline step is done/in-flight/locked" with one visual treatment.

## What to produce

Work in `webview/src/spec-viewer/__redesign__/<provider>/`. For each of the five questions, at least one story; it's fine (encouraged) for one ambitious story to answer several questions at once — e.g. a redesigned full viewer covers Q3 + Q5 and can host Q1's theme and Q4's data styles.

1. **Q1 — Theme proposal.** A token sheet story (swatches + type ramp + the data-display components rendered under your tokens), defined as CSS custom properties scoped to your story's wrapper class. State in `RATIONALE.md` whether you recommend own-theme, VS Code-derived, or hybrid — and what anchors on the host theme.
2. **Q2 — Component library.** Stories for a coherent set: Button (primary/secondary/ghost/destructive), Badge/status pill, Tab, Card, Chip. Grow or reject the Techy direction explicitly.
3. **Q3 — Shell & navigation.** An alternative full-viewer layout story. You may compose the existing production components (`NavigationBar`, `SpecHeader`, `FooterActions`, `ActivityPanel` — import them, don't edit them) or build your own shell. Try at least one structural idea: Activity-as-main-view, title-first header, unified pipeline control separating "where am I" from "how far along is the run", rethought footer CTAs.
4. **Q4 — Data display.** A skin story that restyles the real emitted classes (table above) over real spec content — tables, code, checklists, user stories, requirements, decisions. The TechyCards mechanic (wrapper class + `<style>`) is the cheapest path.
5. **Q5 — Layout.** Show your grid: TOC/content/margins at 3 widths (~800px, ~1100px, ~1400px), a max reading measure, and a density decision (compact vs comfortable).

Plus one file: `webview/src/spec-viewer/__redesign__/<provider>/RATIONALE.md` — for each question, 3–6 sentences: what you propose, what you rejected, and any migration note (which existing classes/tokens your proposal maps onto).

## Story scaffold (copy-paste, adjust `<provider>`)

Create `webview/src/spec-viewer/__redesign__/<provider>/DataDisplay.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from '../../markdown/storyDoc';
import spec172 from '../../../../../specs/172-composable-command-nodes/spec.md?raw';
import tasks172 from '../../../../../specs/172-composable-command-nodes/tasks.md?raw';

const SKIN = `
  .redesign-<provider> .req-row { /* your treatment of a requirement row */ }
  .redesign-<provider> .user-story-header { /* your user-story treatment */ }
  .redesign-<provider> pre.code-block { /* your code-block chrome */ }
`;

const meta: Meta = { title: 'Redesign/<Provider>/Data Display' };
export default meta;
type Story = StoryObj;

export const Spec: Story = {
    render: () => (
        <div class="redesign-<provider>">
            <style>{SKIN}</style>
            <MarkdownDoc md={spec172} />
        </div>
    ),
};

export const Tasks: Story = {
    render: () => (
        <div class="redesign-<provider>">
            <style>{SKIN}</style>
            <MarkdownDoc md={tasks172} />
        </div>
    ),
};
```

`MarkdownDoc` runs the real rendering pipeline, so all production classes and CSS apply — your `<style>` skin layers on top. For **full-viewer** experiments, copy the `InteractiveViewer` / `FullViewer` helpers and the `?raw` + `.spec-context.json` imports from `webview/src/spec-viewer/FullViewer.stories.tsx` into your folder — they show how to feed the signals (`navState`, `viewerState`, `markdownHtml`, `historyEntries`), intercept `stepperClick`/`switchDocument` so navigation works inside the story, and rebuild the TOC after content swaps. Nav-state factories live in `webview/src/spec-viewer/components/__stories__/mockData.ts`.

Real data to feed your stories: `specs/392-living-specs-viewer/` and `specs/172-composable-command-nodes/` — each has `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, checklists, contracts, and a real `.spec-context.json` (history, decisions, per-task summaries). 172 also has `quickstart.md`.

## How you'll be judged

- **Readable in both themes** — AA contrast for body text and headings on Bearded Monokai Black *and* Vivid Light.
- **Scanability & density** — a reviewer finds a requirement, a failing task, or a decision faster than in the current viewer.
- **Navigability** — the shell makes "where am I / how far along is the run / what happens next" legible at a glance.
- **Feasibility** — proposals target the existing emitted class names and token seams, so the winning design can be adopted without rewriting the pipeline.
- **Motion restraint** — animation clarifies state changes; nothing bounces for decoration, and everything degrades under reduced motion.

When you finish: run `npm run build-storybook` (must pass), then list your story URLs at the top of `RATIONALE.md` so they can be opened side by side against the other provider's.

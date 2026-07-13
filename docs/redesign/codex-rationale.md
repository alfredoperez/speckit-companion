# Codex Redesign Investigation

## Story URLs

- [Theme token sheet](http://localhost:6006/?path=/story/redesign-codex-theme--token-sheet)
- [Component library](http://localhost:6006/?path=/story/redesign-codex-component-library--primitives)
- [Full viewer — activity first](http://localhost:6006/?path=/story/redesign-codex-full-viewer--activity-first)
- [Activity — real 392 intent, context, and evaluation](http://localhost:6006/?path=/story/redesign-codex-activity--living-specs-392)
- [Full viewer — custom workflow steps and actions](http://localhost:6006/?path=/story/redesign-codex-full-viewer--custom-workflow-steps)
- [Inline comments — review queue](http://localhost:6006/?path=/story/redesign-codex-inline-comments--review-queue)
- [Inline comments — pinned thread](http://localhost:6006/?path=/story/redesign-codex-inline-comments--open-thread)
- [Inline comments — composer](http://localhost:6006/?path=/story/redesign-codex-inline-comments--comment-composer)
- [Data display — specification](http://localhost:6006/?path=/story/redesign-codex-data-display--specification)
- [Data display — plan](http://localhost:6006/?path=/story/redesign-codex-data-display--plan)
- [Data display — tasks](http://localhost:6006/?path=/story/redesign-codex-data-display--tasks)
- [Data display — decisions](http://localhost:6006/?path=/story/redesign-codex-data-display--decisions)
- [Data display — data model](http://localhost:6006/?path=/story/redesign-codex-data-display--data-model)
- [Data display — quickstart](http://localhost:6006/?path=/story/redesign-codex-data-display--quickstart)
- [Data display — checklist](http://localhost:6006/?path=/story/redesign-codex-data-display--checklist)
- [Data display — tables and code](http://localhost:6006/?path=/story/redesign-codex-data-display--tables-and-code)
- [Responsive layout grid](http://localhost:6006/?path=/story/redesign-codex-layout--responsive-grid)

## Q1 — Theme proposal

I recommend a hybrid theme: the viewer owns a tested light/dark semantic palette for canvas, surfaces, ink, statuses, and syntax, while inheriting the host's UI and editor font families plus accessibility mode. This gives spec documents a stable information hierarchy without pretending the webview is unrelated to its editor. I rejected full VS Code derivation because missing variables and arbitrary theme combinations make contrast unpredictable, and rejected a fully isolated brand theme because typography and accessibility preferences should still feel native. Migration can begin by mapping `--background`, `--surface-*`, `--text-*`, `--accent`, status, and `--code-*` onto the `--cx-*` roles demonstrated here.

## Q2 — Component library

The viewer should grow a small owned library containing Button, Badge, Tab, Card, and Chip, with identical dimensions across state variants. I kept the Techy direction's precision, compact mono metadata, and low-radius geometry, but rejected viewfinder brackets, pervasive uppercase, and hover decoration because they compete with dense document content. Primary fill is reserved for the next action; destructive actions use a soft semantic treatment and navigation uses surface contrast instead of accent fill. Existing `.btn`, `.spec-badge`, `.step-tab`, activity card, and sub-document chip classes can migrate onto these roles incrementally without changing component APIs.

## Q3 — Shell and navigation

The full-viewer story makes Activity an explicit **Overview** and the default view, rather than a utility hidden behind a toggle. The revised 392 story promotes captured intent, context, boundaries, decisions, evaluation, coverage, and work evidence; the long implementation approach is progressively disclosed instead of dominating the page. A persistent document rail answers “where am I,” while separate completion marks answer “how far along is the run”; the two concepts no longer overload one tab style. The inline-comments story keeps comments anchored in the document while collecting pending feedback into one refinement queue. This can migrate over `NavigationBar`, `SpecHeader`, `ActivityPanel`, `FooterActions`, and the existing persisted `reviewComments` path without changing the underlying message model.

The shell must be workflow-driven, not four-step-driven. The custom-workflow story demonstrates arbitrary ordered steps, custom labels, document-producing versus `actionOnly` steps, step-owned sub-files, related artifacts, checkpoints, and extra commands. The primary CTA should use the workflow-derived next label (the production `getApproveLabel()` seam already does this), while secondary workflow commands remain in an “Other actions” menu backed by existing `enhancementButtons`. The navigation can therefore accommodate Security Review, Tickets, Release, or any other configured step without adding a new component case.

## Q4 — Data display

The skin treats a spec as structured operational data rather than generic Markdown: stories become bounded sections, requirements become compact scan rows, decisions become primary cards, and checks use semantic completion color. The page audit now includes specification, plan, tasks, research, data model, quickstart, checklist, and contract; it hides empty `.spec-meta` remnants, gives `.meta-branch` guaranteed contrast, compacts `.phase-header`, and removes `details.template-instructions` from the reader view. Tables retain a real table layout, code gets an owned high-contrast dark surface in both themes, and prose remains quieter than identifiers and headings. I rejected making every row a card because repeated borders slow scanning and create excessive visual weight. All fixes target existing emitted classes, so adoption does not require Markdown pipeline changes.

## Q5 — Space and layout

The proposed shell uses a centered three-column grid: a document rail up to 208px, a reading column capped at 72ch, and contextual run facts up to 260px. At roughly 1100–1400px, only gutters grow; prose never stretches, which removes the current dead TOC gap and uncontained content width. Around 800px the context column disappears, and on narrow screens the document rail becomes a horizontal strip before the content. The density is comfortable rather than compact—14px body at 1.68 line-height, 20px cards, and a consistent 4/8px rhythm—and maps chiefly onto `.content-area`, `#markdown-content`, and `.spec-toc`.

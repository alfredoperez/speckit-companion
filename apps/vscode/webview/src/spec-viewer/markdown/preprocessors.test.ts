import { readFileSync } from 'fs';
import { join } from 'path';
import { preprocessTaskPhases, preprocessRequirements, preprocessEntities, preprocessChecklist, preprocessTechnicalContext, preprocessConstitution, preprocessDecisions } from './preprocessors';
import { renderMarkdown, setTaskSummaries } from './renderer';

describe('preprocessTaskPhases', () => {
    it('wraps a "## Phase N:" heading in a phase-header block with the phase number', () => {
        const out = preprocessTaskPhases('## Phase 2: Foundational (Blocking Prerequisites)\n');

        expect(out).toContain('class="phase-header"');
        expect(out).toContain('Phase 2');
        expect(out).toContain('Foundational (Blocking Prerequisites)');
        expect(out).toContain('id="phase-2"');
    });

    it('lifts the MVP marker and priority tag into chips and strips them from the title', () => {
        const out = preprocessTaskPhases('## Phase 3: User Story 1 — Trustworthy status (P1) 🎯 MVP\n');

        expect(out).toContain('phase-chip mvp');
        expect(out).toContain('phase-chip prio p1');
        expect(out).toContain('User Story 1 — Trustworthy status');
        expect(out).not.toContain('🎯');
        expect(out).not.toMatch(/\(P1\)/);
    });

    it('leaves a non-phase H2 heading untouched', () => {
        const input = '## Dependencies & Execution Order\n';

        expect(preprocessTaskPhases(input)).toBe(input);
    });

    it('transforms every phase heading in a multi-phase document', () => {
        const input = [
            '## Phase 1: Setup (Shared Infrastructure)',
            '',
            '- [X] T001 do a thing',
            '',
            '## Phase 4: User Story 2 (P1)',
            '',
        ].join('\n');

        const out = preprocessTaskPhases(input);
        const headers = out.match(/class="phase-header"/g) ?? [];

        expect(headers).toHaveLength(2);
        expect(out).toContain('- [X] T001 do a thing');
    });

    it('survives the full renderMarkdown pipeline alongside the task list', () => {
        const tasks = [
            '## Phase 3: User Story 1 — Trustworthy status (P1) 🎯 MVP',
            '',
            '- [X] T010 Implement deriveViewerState',
            '- [ ] T011 Wire the header badge',
            '',
        ].join('\n');

        const html = renderMarkdown(tasks);

        // Phase header rendered (not a raw "## Phase" heading)…
        expect(html).toContain('class="phase-header"');
        expect(html).toContain('phase-chip mvp');
        expect(html).not.toContain('<h2>Phase 3');
        // …and the checkbox list below it still renders as task items.
        expect(html).toContain('class="task-item');
        expect(html).toContain('<input type="checkbox" checked');
        // The id is a chip ahead of the description, not part of the sentence.
        expect(html).toContain('<span class="task-item__id">T010</span>Implement deriveViewerState');
    });
});

describe('preprocessRequirements', () => {
    it('turns an FR bullet into an accent-badged req-row', () => {
        const out = preprocessRequirements('- **FR-001** The system MUST keep the layout.\n');

        expect(out).toContain('class="req-row" data-kind="fr"');
        expect(out).toContain('>FR-001<');
        expect(out).toContain('The system');
    });

    it('tags SC bullets with the success kind and renders inline code/bold', () => {
        const out = preprocessRequirements('- **SC-002**: The `banner` MUST **stack** below.\n');

        expect(out).toContain('data-kind="sc"');
        expect(out).toContain('<code');
        expect(out).toContain('<strong>stack</strong>');
    });

    it('leaves key-entity bold labels and plain bullets untouched', () => {
        expect(preprocessRequirements('- **SpecContext**: the document.\n'))
            .toBe('- **SpecContext**: the document.\n');
        expect(preprocessRequirements('- A single width threshold.\n'))
            .toBe('- A single width threshold.\n');
    });

    it('fires on the real reference specs (327 + 349)', () => {
        const root = join(__dirname, '../../../..');
        const spec327 = readFileSync(join(root, 'specs/327-install-banner-responsive/spec.md'), 'utf8');
        const spec349 = readFileSync(join(root, 'specs/349-cleanup-followups/spec.md'), 'utf8');

        const html327 = renderMarkdown(spec327);
        const html349 = renderMarkdown(spec349);

        // 327: 8 FRs + 5 SCs become req-rows
        expect((html327.match(/class="req-row"/g) ?? []).length).toBeGreaterThanOrEqual(13);
        expect(html327).toContain('data-kind="fr"');
        expect(html327).toContain('data-kind="sc"');
        // 349: user-story cards already render; requirements now badge too
        expect(html349).toContain('class="req-row"');
    });
});

describe('preprocessEntities', () => {
    it('turns Key Entities bullets into entity rows with name + qualifier + desc', () => {
        const md = [
            '### Key Entities',
            '',
            '- **SpecContext** (`.spec-context.json`) — the per-spec lifecycle record.',
        ].join('\n');
        const out = preprocessEntities(md);

        expect(out).toContain('class="entity-row"');
        expect(out).toContain('class="entity-name"');
        expect(out).toContain('class="entity-paren"');
        expect(out).toContain('the per-spec lifecycle record');
    });

    it('only transforms bullets inside the Key Entities section', () => {
        const md = [
            '## Assumptions',
            '- **Something** bold but not an entity',
            '',
            '### Key Entities',
            '- **Event log** — the append-only finish log',
        ].join('\n');
        const out = preprocessEntities(md);

        expect(out).toContain('- **Something** bold but not an entity'); // untouched
        expect(out).toContain('class="entity-row"'); // entity transformed
        expect((out.match(/entity-row/g) ?? []).length).toBe(1);
    });
});

describe('preprocessChecklist', () => {
    const checklist = [
        '# Specification Quality Checklist: Demo',
        '',
        '**Purpose**: Validate completeness',
        '',
        '## Content Quality',
        '- [x] No implementation details',
        '- [x] Focused on user value',
        '- [ ] Overview present',
        '',
        '## Notes',
        '- A trailing note.',
    ].join('\n');

    it('groups checklist sections into pass/fail report cards with a count', () => {
        const out = preprocessChecklist(checklist);

        expect(out).toContain('class="ck-group"');
        expect(out).toContain('class="ck-count">2/3<'); // 2 of 3 checked
        expect(out).toContain('class="ck-item ok"');
        expect(out).toContain('class="ck-item"'); // the unchecked one (no ok)
    });

    it('leaves the Notes section as plain markdown', () => {
        const out = preprocessChecklist(checklist);
        expect(out).toContain('## Notes');
        expect(out).toContain('- A trailing note.');
    });

    it('does not touch a non-checklist document (tasks.md with ## Phase)', () => {
        const tasks = '# Tasks\n\n## Phase 1: Setup\n- [x] **T001** do it\n';
        expect(preprocessChecklist(tasks)).toBe(tasks);
    });
});

describe('tasks.md capture merge (setTaskSummaries)', () => {
    afterEach(() => setTaskSummaries(null));

    it('renders the captured did + files under a task when a summary exists', () => {
        setTaskSummaries({
            T001: { did: 'Made the banner a query container', files: ['webview/styles/spec-viewer/_install-banner.css'] },
        });
        const html = renderMarkdown('- [x] **T001** Make the banner responsive\n');

        expect(html).toContain('task-item__capture');
        expect(html).toContain('Made the banner a query container');
        expect(html).toContain('_install-banner.css');
    });

    it('omits the capture block when no summary is set', () => {
        setTaskSummaries(null);
        const html = renderMarkdown('- [x] **T001** Make the banner responsive\n');
        expect(html).not.toContain('task-item__capture');
    });
});

describe('preprocessTechnicalContext', () => {
    it('turns the Technical Context key/value lines into a grid', () => {
        const md = [
            '## Technical Context',
            '',
            '**Language/Version**: TypeScript 5.3+ (ES2022, strict)',
            '**Primary Dependencies**: VS Code Extension API, Preact',
            '',
            '## Constitution Check',
        ].join('\n');
        const out = preprocessTechnicalContext(md);

        expect(out).toContain('class="tech-grid"');
        expect((out.match(/class="tech-cell"/g) ?? []).length).toBe(2);
        expect(out).toContain('class="tech-key"');
        expect(out).toContain('TypeScript 5.3+');
    });

    it('leaves bold key/value lines outside the section untouched', () => {
        const md = '## Summary\n\n**Branch**: 060-x\n';
        expect(preprocessTechnicalContext(md)).toBe(md);
    });
});

describe('preprocessConstitution', () => {
    it('turns PASS/FAIL bullets into verdict rows', () => {
        const md = [
            '## Constitution Check',
            '',
            '- **I. Extensibility**: PASS — schema accepts unknown fields.',
            '- **II. Spec-Driven Workflow**: FAIL — needs a gate.',
            '',
            '## Project Structure',
        ].join('\n');
        const out = preprocessConstitution(md);

        expect((out.match(/class="con-row"/g) ?? []).length).toBe(2);
        expect(out).toContain('class="verdict pass"');
        expect(out).toContain('class="verdict fail"');
        expect(out).toContain('schema accepts unknown fields');
    });

    it('leaves bold bullets outside the Constitution section untouched', () => {
        const md = '## Notes\n\n- **Thing**: PASS — not a constitution row\n';
        expect(preprocessConstitution(md)).toBe(md);
    });

    it('keeps the heading for a table-form Constitution Check (no bullets)', () => {
        const md = [
            '## Constitution Check',
            '',
            '| Principle | Status |',
            '| --- | --- |',
            '| I. Extensibility | PASS |',
            '',
            '## Project Structure',
        ].join('\n');
        const out = preprocessConstitution(md);

        // No verdict rows are emitted for the table form, but the section header
        // must survive (it used to be stripped, leaving the table headerless).
        expect(out).not.toContain('class="con-row"');
        expect(out).toContain('## Constitution Check');
        expect(out).toContain('| I. Extensibility | PASS |');
    });

    it('renders the real 060 plan.md grid + verdict rows through the pipeline', () => {
        const root = join(__dirname, '../../../..');
        const plan = readFileSync(join(root, 'specs/060-spec-context-tracking/plan.md'), 'utf8');
        const html = renderMarkdown(plan);

        expect(html).toContain('class="tech-grid"');
        expect(html).toContain('class="con-row"');
        expect(html).toContain('class="verdict pass"');
    });

    it('collapses both plan sections and puts the verdict before the name', () => {
        const tc = preprocessTechnicalContext('## Technical Context\n\n**Language/Version**: TS\n\n## Next\n');
        expect(tc).toContain('<details class="md-collapsible"');
        expect(tc).not.toContain('## Technical Context'); // heading replaced by the summary

        const con = preprocessConstitution('## Constitution Check\n\n- **I. Extensibility**: PASS — ok.\n\n## Next\n');
        expect(con).toContain('<details class="md-collapsible"');
        expect(con).toMatch(/verdict pass">PASS<\/span><span class="con-name"/);
    });
});

describe('renderTable escaped pipes', () => {
    it('keeps an escaped-pipe cell as one column and unescapes the pipe', () => {
        const md = ['| Field | Type |', '|---|---|', '| `x` | `"a" \\| "b"` |', ''].join('\n');
        const html = renderMarkdown(md);
        const body = html.split('<tbody>')[1] ?? '';

        expect((body.match(/<td>/g) ?? []).length).toBe(2);
        expect(html).toContain('"a" | "b"');
    });
});

describe('preprocessDecisions', () => {
    it('wraps each Decision block in a card with field rows', () => {
        const md = [
            '## Decision 1: Status vocabulary',
            '',
            '**Decision**: use a closed enum.',
            '**Rationale**: simpler for the viewer.',
            '',
            '## Decision 2: Source of truth',
            '',
        ].join('\n');
        const out = preprocessDecisions(md);

        expect((out.match(/class="decision-card"/g) ?? []).length).toBe(2);
        expect(out).toContain('Decision 1');
        expect(out).toContain('decision-label--rationale');
    });

    it('does not touch a doc with no Decision headings', () => {
        const md = '## Summary\n\nText.\n';
        expect(preprocessDecisions(md)).toBe(md);
    });
});

describe('acceptance scenarios', () => {
    it('keeps the scenario as one flowing sentence with inline keyword emphasis', () => {
        const md = ['**Acceptance Scenarios**:', '', '1. **Given** a spec, **When** I open it, **Then** it loads.', ''].join('\n');
        const html = renderMarkdown(md);

        // Inline <strong> keywords, not stacked .gwt-step rows.
        expect(html).not.toContain('gwt-step');
        expect(html).toContain('<strong class="keyword-given">Given</strong>');
        expect(html).toContain('<strong class="keyword-then">Then</strong>');
        // The sentence text stays intact (no per-clause line splitting).
        expect(html).toContain('a spec,');
    });
});

describe('inline-comment affordance on components', () => {
    it('wraps a requirement row as a commentable line with the + button', () => {
        const html = renderMarkdown('- **FR-001** The system MUST do X.\n');

        expect(html).toContain('class="line component-line"');
        expect(html).toContain('class="line-add-btn"');
        expect(html).toContain('class="req-row"');
    });

    it('wraps a key-entity row as a commentable line', () => {
        const html = renderMarkdown('### Key Entities\n\n- **Thing** — a thing.\n');

        expect(html).toContain('class="line component-line"');
        expect(html).toContain('class="entity-row"');
    });
});

import { renderMarkdown } from '../renderer';

const lines = (...l: string[]) => l.join('\n');

describe('DecisionCard', () => {
    const research = lines(
        '# Research: Step rail',
        '',
        '## Decision 1 — Read the step dir in TypeScript',
        '',
        '**Decision**: `projectSteps.ts` reads the directory with fs. Leans on FR-002.',
        '**Rationale**: The builder reads the graph once.',
        '**Alternatives considered**:',
        '- **Shell out to pipeline-graph.py**: Cost, and the Python dependency.',
        '- **Cache the graph**: Puts the launch back on first render.',
        '',
        '## Decision 2: No cache',
        '',
        '**Decision**: Read the directory on each resolution.',
        '',
    );

    it('renders each decision as a card with an anchor id the id chips can jump to', () => {
        const html = renderMarkdown(research);
        expect((html.match(/class="lg-decision /g) ?? []).length).toBe(2);
        expect(html).toContain('id="ref-d1"');
        expect(html).toContain('id="ref-d2"');
    });

    it('folds turned-down alternatives into a list with their reasons', () => {
        const html = renderMarkdown(research);
        expect(html).toContain('2 turned down');
        expect(html).toContain('Shell out to pipeline-graph.py');
        expect(html).toContain('Cost, and the Python dependency.');
        expect(html).toContain('<details class="lg-turned">');
    });

    it('puts the why in its own block and links the ids the decision leans on', () => {
        const html = renderMarkdown(research);
        expect(html).toContain('lg-why');
        expect(html).toContain('href="#ref-fr-002"');
    });

    it('marks a decision with no rationale and no alternatives', () => {
        const html = renderMarkdown(research);
        expect(html).toContain('No rationale');
        expect(html).toContain('Decided');
    });

    it('adds a DecisionsStrip with one jump row per decision at the top of research', () => {
        const html = renderMarkdown(research);
        expect(html).toContain('Decisions at a glance');
        expect(html).toContain('href="#ref-d1"');
        expect(html.indexOf('lg-strip')).toBeLessThan(html.indexOf('class="lg-decision '));
    });

    it('keeps Question/Finding/Decision entries in one list in document order', () => {
        const md = lines(
            '# Phase 0 Research: Redis',
            '',
            '## R1 — What actually kills the process',
            '',
            '**Question**: Which client emits the fatal event?',
            '',
            '**Finding**: the store never attaches an `error` listener.',
            '',
            '**Decision**: attach `client.on(\'error\')` at construction. FR-003',
            '',
            '## Decision 2: Poll interval',
            '',
            '**Decision**: five seconds.',
            '',
        );
        const html = renderMarkdown(md);
        expect(html).toContain('id="ref-r1"');
        expect(html).toContain('data-kind="question"');
        expect(html).toContain('Answered');
        expect(html.indexOf('ref-r1')).toBeLessThan(html.indexOf('ref-d2'));
    });

    it('folds a long finding behind a Read the evidence row', () => {
        const md = lines(
            '# Research: X',
            '',
            '## R1 - Mechanism',
            '',
            '**Question**: Why?',
            '',
            '**Finding**: first paragraph.',
            '',
            '```js',
            'var a = 1;',
            '```',
            '',
            'More text.',
            '',
            '**Decision**: do the thing.',
            '',
        );
        const html = renderMarkdown(md);
        expect(html).toContain('Read the evidence');
        expect(html).toContain('var a = 1;');
    });

    it('escapes repository text', () => {
        const html = renderMarkdown(lines('# Research', '', '## Decision 1: <img src=x onerror=1>', '', '**Decision**: <script>x</script>', ''));
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>');
    });

    it('handles spec-kit template headings that carry only labels', () => {
        const md = lines('# Research: Z', '', '### Storage engine', '', '**Decision**: SQLite', '**Rationale**: embedded', '**Alternatives considered**: Postgres, too heavy', '');
        const html = renderMarkdown(md);
        expect(html).toContain('Storage engine');
        expect(html).toContain('1 turned down');
    });

    it('turns follow-up bullets into deferred rows', () => {
        const md = lines('# Research: Y', '', '## Follow-up work identified', '', '- Migrate the cache store', '- Emit a metric', '');
        const html = renderMarkdown(md);
        expect(html).toContain('lg-follow');
        expect(html).toContain('Deferred');
    });

    it('does not touch a document without decisions', () => {
        expect(renderMarkdown('# Research\n\nJust prose.\n')).not.toContain('lg-decision');
    });
});

describe('plan Key decisions', () => {
    it('renders bold-led bullets as decision cards and keeps the heading', () => {
        const md = lines(
            '# Implementation Plan: A',
            '',
            '## Key Decisions',
            '',
            '- **Order the check completion-first.** Reordering returns not-in-flight early (FR-001). Alternatives: keep the status win.',
            '- **Settle forward-only.** Never move backward.',
            '',
        );
        const html = renderMarkdown(md);
        expect(html).toContain('Key Decisions');
        expect((html.match(/class="lg-decision /g) ?? []).length).toBe(2);
        expect(html).toContain('1 turned down');
        expect(html).toContain('href="#ref-fr-001"');
        expect(html).not.toContain('Decisions at a glance');
    });
});

describe('DataEntityCard', () => {
    const md = lines(
        '# Data Model: Dialect',
        '',
        '## ParsedStatement',
        '',
        'File: `backend/models/parsed_statement.rs` (new).',
        '',
        '| Field | Type | Invariant |',
        '|---|---|---|',
        '| source | `Arc<str>` | Original text |',
        '| span | `SqlSourceSpan` | Original bounds |',
        '',
        'Immutable and role-independent.',
        '',
        '## SqlSourceSpan',
        '',
        '| Field | Type | Invariant |',
        '|---|---|---|',
        '| start | `u32` | Byte offset |',
        '',
    );

    it('renders field, type and rule lanes with the entity id', () => {
        const html = renderMarkdown(md);
        expect(html).toContain('id="ref-parsedstatement"');
        expect(html).toContain('2 fields');
        expect(html).toContain('lg-f-rule');
        expect(html).toContain('Original text');
        expect(html).toContain('Immutable and role-independent.');
    });

    it('links a type that names another entity and counts entities', () => {
        const html = renderMarkdown(md);
        expect(html).toContain('href="#ref-sqlsourcespan"');
        expect(html).toContain('2 entities');
    });

    it('shows the file as a chip and the qualifier from the File line', () => {
        const html = renderMarkdown(md);
        expect(html).toContain('parsed_statement.rs');
        expect(html).toContain('new');
    });

    it('folds a variants table', () => {
        const html = renderMarkdown(lines('# Data Model', '', '## StatementPayload', '', '| Variant | Payload | Use |', '|---|---|---|', '| Sql | `Box<Statement>` | standard |', ''));
        expect(html).toContain('lg-entity__variants');
        expect(html).toContain('Show 1 variant');
    });

    it('leaves a table without a type column to the normal renderer', () => {
        const html = renderMarkdown(lines('# Data Model', '', '## Notes', '', '| Name | Meaning |', '|---|---|', '| a | b |', ''));
        expect(html).not.toContain('lg-entity');
    });
});

describe('TransitionList', () => {
    it('reads From, Event and To left to right', () => {
        const html = renderMarkdown(lines(
            '# Data Model: Board',
            '',
            '## State transitions',
            '',
            '| From | Event | To |',
            '|---|---|---|',
            '| State A picked | Click on state B | State B picked |',
            '| Any | Board redraws | Drawn |',
            '',
        ));
        expect(html).toContain('lg-trans__row');
        expect(html).toContain('2 · 4 states');
        expect(html).toContain('Click on state B');
    });
});

describe('EntityRelations', () => {
    it('turns relation bullets into rows between known entities', () => {
        const html = renderMarkdown(lines(
            '# Data Model',
            '',
            '## A',
            '',
            '| Field | Type |',
            '|---|---|',
            '| b | `B` |',
            '',
            '## B',
            '',
            '| Field | Type |',
            '|---|---|',
            '| x | `u8` |',
            '',
            '## Key Relationships',
            '',
            '- **A** has one **B**',
            '',
        ));
        expect(html).toContain('lg-rel__row');
        expect(html).toContain('has one');
    });
});

describe('ContractCard', () => {
    it('renders a command with signature, inputs and a promise', () => {
        const html = renderMarkdown(lines(
            '# Contract: living-validate',
            '',
            '## The script',
            '',
            'A shape check over every registered spec.',
            '',
            '```',
            'python3 living_validate.py [--root PATH] [--json]',
            '```',
            '',
            '| Flag | Meaning |',
            '|---|---|',
            '| `--root` | Repository root. |',
            '| `--json` | Emit JSON. |',
            '',
            '**Exit code is always 0.**',
            '',
        ));
        expect(html).toContain('lg-method">CMD');
        expect(html).toContain('2 inputs');
        expect(html).toContain('living_validate.py');
        expect(html).toContain('Exit code is always 0.');
        expect(html).toContain('Contracts');
    });

    it('labels an HTTP endpoint by its verb and lists errors', () => {
        const html = renderMarkdown(lines(
            '# Contract: API',
            '',
            '## POST /api/items',
            '',
            '| Status | Meaning |',
            '|---|---|',
            '| 400 | Bad body |',
            '',
        ));
        expect(html).toContain('lg-method">POST');
        expect(html).toContain('Bad body');
    });

    it('leaves a capability matrix alone', () => {
        const html = renderMarkdown(lines('# Contract: Matrix', '', '| ID | Family |', '|---|---|', '| PG-DDL | DDL |', ''));
        expect(html).not.toContain('lg-contract');
    });
});

describe('QuickstartSteps', () => {
    it('splits a numbered list into steps with commands and an expected result', () => {
        const html = renderMarkdown(lines(
            '# Quickstart: Demo',
            '',
            '1. **Switch off by default** (FR-002): open the page. Expect the "not enabled" page.',
            '2. **Turn it on**: run:',
            '   ```',
            '   do ##class(X).Set(1)',
            '   ```',
            '',
        ));
        expect((html.match(/class="lg-step /g) ?? []).length).toBe(2);
        expect(html).toContain('Switch off by default');
        expect(html).toContain('lg-expect');
        expect(html).toContain('do ##class(X).Set(1)');
        expect(html).toContain('data-ref="FR-002"');
        expect(html).toContain('2 steps');
    });

    it('reads Step N headings', () => {
        const html = renderMarkdown(lines('# Quickstart: P', '', '### Step 1: Add Dependency', '', 'Add to `Cargo.toml`:', '', '```toml', '[dependencies]', '```', '', '### Step 2: Build', '', 'Run it.', ''));
        expect((html.match(/class="lg-step /g) ?? []).length).toBe(2);
        expect(html).toContain('[dependencies]');
    });

    it('leaves a single numbered item as a normal list', () => {
        expect(renderMarkdown('# Quickstart\n\n1. only one\n')).not.toContain('lg-step');
    });
});

import {
    parseTree,
    preprocessComplexity,
    preprocessConstitution,
    preprocessPlanSummary,
    preprocessProjectTree,
    preprocessTechnicalContext,
} from '../ledger/plan';
import { renderMarkdown } from '../renderer';

const PAGER_GATE = [
    '## Constitution Check',
    '',
    '*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*',
    '',
    '| Principle | Status | Notes |',
    '|-----------|--------|-------|',
    '| I. Performance First | ✅ Pass | Pager selection happens once at startup |',
    '| II. Composability & Modularity | ✅ Pass | New `pager` module with clear interfaces |',
    '',
    '## Project Structure',
].join('\n');

describe('ConstitutionCheck', () => {
    it('reads the stock three-column table into pass rows with numerals and names', () => {
        const out = preprocessConstitution(PAGER_GATE);
        expect((out.match(/class="pl-gate-row /g) ?? []).length).toBe(2);
        expect(out).toContain('<span class="pl-gate-num">II</span>');
        expect(out).toContain('Composability &amp; Modularity');
        expect(out).toContain('Gate passed');
        expect(out).not.toContain('GATE: Must pass');
        expect(out).toContain('## Project Structure');
    });

    it('blocks the gate and counts the failing principle', () => {
        const md = '## Constitution Check\n\n| Principle | Status | Notes |\n|---|---|---|\n| I. A | ✅ Pass | ok |\n| II. B | ❌ Fail | broken |\n';
        const out = preprocessConstitution(md);
        expect(out).toContain('Gate blocked');
        expect(out).toContain('1 fails');
        expect(out).toContain('pl-gate-row--fail');
    });

    it('marks a justified row and washes its reason', () => {
        const md = '## Constitution Check\n\n- **III. Simplicity**: JUSTIFIED — one extra module, see Complexity Tracking.\n';
        const out = preprocessConstitution(md);
        expect(out).toContain('pl-gate-row--justified');
        expect(out).toContain('pl-gate-note--why');
        expect(out).toContain('Gate passed');
    });

    it('reads a two-column Principle | Assessment table', () => {
        const md = '## Constitution Check\n\n| Principle | Assessment |\n|---|---|\n| Docs are part of the change | PASS: commands doc, changelog |\n';
        const out = preprocessConstitution(md);
        expect(out).toContain('pl-gate-row--pass');
        expect(out).toContain('commands doc, changelog');
    });

    it('leaves an unfilled template section exactly as written', () => {
        const md = '## Constitution Check\n\n[Gates determined based on constitution file]\n\n## Next\n';
        expect(preprocessConstitution(md)).toBe(md);
    });

    it('escapes repository text', () => {
        const md = '## Constitution Check\n\n- **I. <img src=x onerror=1>**: PASS — <script>x</script>\n';
        const out = preprocessConstitution(md);
        expect(out).not.toContain('<img');
        expect(out).not.toContain('<script>');
    });
});

describe('ComplexityTracking', () => {
    it('turns the three-column table into ledger rows, one justified', () => {
        const md = [
            '## Complexity Tracking',
            '',
            '| Violation | Why Needed | Simpler Alternative Rejected Because |',
            '|-----------|------------|-------------------------------------|',
            '| New --waves mode | Foundational must split at Wait lines | A prose rule cannot be tested |',
        ].join('\n');
        const out = preprocessComplexity(md);
        expect(out).toContain('pl-cx-row');
        expect(out).toContain('New --waves mode');
        expect(out).toContain('Justified');
        expect(out).toContain('1 justified');
    });

    it('flags a missing justification with a dashed slot and a word', () => {
        const md = '## Complexity Tracking\n\n| Violation | Why Needed | Simpler |\n|---|---|---|\n| Fourth preset | | Reusing it failed |\n';
        const out = preprocessComplexity(md);
        expect(out).toContain('Why needed: missing');
        expect(out).toContain('Needs justification');
    });

    it('shows Clear for the nothing-to-justify line', () => {
        const out = preprocessComplexity('## Complexity Tracking\n\nNo constitution violations requiring justification.\n');
        expect(out).toContain('Clear');
        expect(out).toContain('No constitution violations requiring justification.');
    });

    it('leaves the template placeholder row alone', () => {
        const md = '## Complexity Tracking\n\n| Violation | Why Needed | Simpler |\n|---|---|---|\n| [e.g., 4th project] | [current need] | [why] |\n';
        expect(preprocessComplexity(md)).toBe(md);
    });
});

describe('ProjectTree', () => {
    const fence = [
        'src/',
        '├── settings.rs          # MODIFY: Add pager fields',
        '├── pager.rs             # NEW: Selection logic',
        '└── pager/',
        '    └── mod.rs           # Module exports',
    ];

    it('reads depth, full paths, and the change word from the comment', () => {
        const entries = parseTree(fence)!;
        expect(entries.map((e) => e.depth)).toEqual([0, 1, 1, 1, 2]);
        expect(entries[1]).toMatchObject({ path: 'src/settings.rs', change: 'modified', note: 'Add pager fields' });
        expect(entries[2].change).toBe('new');
        expect(entries[4].path).toBe('src/pager/mod.rs');
        expect(entries[4].change).toBe('');
    });

    it('renders chips and a neutral New / Modified word, only when the plan says so', () => {
        const md = ['## Project Structure', '', '```text', ...fence, '```', ''].join('\n');
        const out = preprocessProjectTree(md);
        expect(out).toContain('data-file="src/pager.rs"');
        expect(out).toContain('pl-tree-stat--new');
        expect(out).toContain('pl-tree-stat--modified');
        expect((out.match(/pl-tree-stat /g) ?? []).length).toBe(2);
        expect(out).toContain('3 files · 1 new · 1 modified');
        expect(out).not.toContain('```');
    });

    it('works on 2-space indented trees without box characters', () => {
        const entries = parseTree(['speckit-extension/', '  scripts/', '    a.py   # new: splitter']);
        expect(entries!.map((e) => e.depth)).toEqual([0, 1, 2]);
        expect(entries![2].change).toBe('new');
    });

    it('leaves fences outside a structure section, and non-trees, alone', () => {
        const md = ['## Notes', '', '```text', ...fence, '```'].join('\n');
        expect(preprocessProjectTree(md)).toBe(md);
        const flat = ['## Project Structure', '', '```text', 'just one line', '```'].join('\n');
        expect(preprocessProjectTree(flat)).toBe(flat);
    });
});

describe('TechnicalContext', () => {
    const facts = (n: number, extra = '') =>
        ['## Technical Context', '', ...Array.from({ length: n }, (_, i) => `**Fact ${i}**: value ${i}`), extra, ''].join('\n');

    it('shows an open question as a hollow ring and a word, and counts it', () => {
        const out = preprocessTechnicalContext('## Technical Context\n\n**Storage**: NEEDS CLARIFICATION\n**Testing**: jest\n');
        expect(out).toContain('Needs clarification');
        expect(out).toContain('2 facts · 1 open');
    });

    it('folds facts past six into a disclosure naming them', () => {
        const out = preprocessTechnicalContext(facts(8));
        expect((out.match(/class="tech-cell"/g) ?? []).length).toBe(8);
        expect(out).toContain('2 more facts · Fact 6, Fact 7');
    });

    it('keeps a wrapped value on its fact', () => {
        const out = preprocessTechnicalContext('## Technical Context\n\n**Testing**: pytest\ntest_dispatch.py\n');
        expect(out).toContain('pytest test_dispatch.py');
    });
});

describe('SummaryLede', () => {
    const plan = [
        '## Summary',
        '',
        'Implement stops building the whole phase itself. The decision lives in the script. One more. Two more. Three more.',
        '',
        PAGER_GATE,
    ].join('\n');

    it('bolds the first sentence, folds the rest, and counts the gate', () => {
        const out = preprocessPlanSummary(plan);
        expect(out).toContain('<strong>Implement stops building the whole phase itself.</strong>');
        expect(out).toContain('Read the rest · 4 more sentences');
        expect(out).toContain('Passed');
    });

    it('stays out of a document that is not a plan', () => {
        const md = '## Summary\n\nSomething.\n';
        expect(preprocessPlanSummary(md)).toBe(md);
    });

    it('leaves a template placeholder summary untouched', () => {
        const md = '## Summary\n\n[Extract from feature spec]\n\n## Technical Context\n';
        expect(preprocessPlanSummary(md)).toBe(md);
    });

    it('runs through the whole renderer', () => {
        const html = renderMarkdown(plan);
        expect(html).toContain('pl-summary');
        expect(html).toContain('pl-gate-row');
    });
});

describe('plain bullet plans', () => {
    it('reads "- Key: value" bullets as technical context facts', () => {
        const out = preprocessTechnicalContext('## Technical context\n\n- Rust 1.94, edition 2021.\n- Models: one per file.\n- Build/test: cargo nextest.\n');
        expect(out).toContain('tech-grid');
        expect(out).toContain('Models');
    });

    it('shows a two-column principle table with no verdicts as a pending gate', () => {
        const out = preprocessConstitution('## Constitution check\n\n| Principle | Obligation |\n|---|---|\n| I Speed | Fast. |\n');
        expect(out).toContain('pl-verdict--pending');
    });
});

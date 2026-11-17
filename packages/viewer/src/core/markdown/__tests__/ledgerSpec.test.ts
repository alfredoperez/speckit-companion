import { preprocessSpecLedger, setSpecLedgerTasks } from '../ledger/specDoc';
import { isSpecDocument, parseTasks, splitScenario } from '../ledger/specModel';
import { renderMarkdown } from '../renderer';

const SPEC = [
    '# Feature Specification: New Monitor Interface',
    '',
    '**Feature Branch**: `002-new-ui`',
    '',
    '**Created**: 2026-10-09',
    '',
    '**Status**: Clarified',
    '',
    '**Input**: User description: "uma interface web nova"',
    '',
    '## User Scenarios & Testing *(mandatory)*',
    '',
    '### User Story 1 - See the health at a glance (Priority: P1)',
    '',
    'An operator opens the monitor and sees whether the instance is healthy.',
    '',
    '**Why this priority**: The Overview is the first screen.',
    '',
    '**Independent Test**: Turn it on and compare every figure (FR-001).',
    '',
    '**Acceptance Scenarios**:',
    '',
    '1. **Given** the interface is on, **When** the Overview opens, **Then** all metrics are shown (FR-001).',
    '2. **Given** a metric is a warning, **When** it is shown, **Then** status is text as well as color.',
    '3. **Given** the Overview stays open, **When** the interval passes, **Then** figures update.',
    '',
    '---',
    '',
    '### User Story 2 - Sign in once (Priority: P2)',
    '',
    'A user signs in once.',
    '',
    '### Edge Cases',
    '',
    '- A period crosses a daylight-saving change: times stay in order',
    '- Several thousand processes are running: the list stays responsive',
    '',
    '## Requirements *(mandatory)*',
    '',
    '### Functional Requirements',
    '',
    '- **FR-001**: The Overview MUST show all metrics.',
    '- **FR-002**: The interface MUST start switched off.',
    '- **FR-009a**: A cache operation MUST be abandoned after **at most 1 second**.',
    '',
    '### Key Entities *(include if feature involves data)*',
    '',
    '- **Overview metric**: a named figure with value and status.',
    '',
    '## Success Criteria *(mandatory)*',
    '',
    '### Measurable Outcomes',
    '',
    '- **SC-001**: Each operator spots every non-ok metric within 5 seconds (US1, FR-001).',
    '- **SC-008**: ~~Four of five participants rate it clearer~~ (withdrawn)',
    '',
    '## Assumptions',
    '',
    '- The Overview refreshes every 10 seconds by default.',
    '',
    '## Clarifications',
    '',
    '### Session 2026-10-09',
    '',
    '- Q: What happens to the old pages? -> A: They are marked obsolete (FR-002).',
    '- Q: Should the export include hidden columns?',
].join('\n');

const lines = (html: string, cls: string) => html.split('\n').filter((l) => l.includes(cls));

describe('Ledger spec document', () => {
    beforeEach(() => setSpecLedgerTasks(null));

    describe('isSpecDocument', () => {
        it('recognises a spec and leaves plans, tasks and checklists alone', () => {
            expect(isSpecDocument(SPEC)).toBe(true);
            expect(isSpecDocument('# Implementation Plan\n\n## Summary\n\ntext')).toBe(false);
            expect(isSpecDocument('# Tasks\n\n## Phase 1: Setup\n\n- [ ] T001 x')).toBe(false);
            expect(isSpecDocument('# Requirements Checklist\n\n## Requirements\n\n- **FR-001** x')).toBe(false);
        });
        it('returns a non-spec document unchanged', () => {
            const plan = '# Plan\n\n## Summary\n\ntext';
            expect(preprocessSpecLedger(plan)).toBe(plan);
        });
    });

    describe('SpecHeader and StoryIndex', () => {
        const out = preprocessSpecLedger(SPEC);
        it('titles the page with the spec title and counts what it holds', () => {
            expect(out).toContain('<h1 class="lg-sp-title" id="new-monitor-interface">New Monitor Interface</h1>');
            expect(out).toContain('SPEC · 002-new-ui · CREATED 2026-10-09');
            expect(out).toContain('2 stories · 3 requirements · 2 criteria · 2 edge cases');
            expect(out).toContain('Clarified');
        });
        it('lists each story with a jump link and priority', () => {
            expect(out).toContain('href="#ref-us-1"');
            expect(out).toContain('one is P1');
            expect(out).toContain('An operator opens the monitor and sees whether the instance is healthy.');
        });
        it('strips (mandatory) and the include-if note from headings', () => {
            expect(out).toContain('## User Scenarios & Testing\n');
            expect(out).not.toMatch(/\(mandatory\)|include if/);
        });
    });

    describe('StoryCard', () => {
        const out = preprocessSpecLedger(SPEC);
        const card = lines(out, 'lg-sp-story')[0];
        it('wraps the whole story with its anchor, priority, why and test-alone block', () => {
            expect(card).toContain('id="ref-us-1"');
            expect(card).toContain('lg-priority');
            expect(card).toContain('WHY P1');
            expect(card).toContain('Test it alone');
            expect(card).not.toContain('**');
        });
        it('splits scenarios into Given / When / Then rows and folds the rest', () => {
            expect(card).toContain('lg-sp-kw--given');
            expect(card).toContain('lg-sp-kw--then');
            expect(card).toContain('1 more scenario');
        });
        it('chips the requirements the story names and flags an unresolved one', () => {
            expect(card).toContain('data-ref="FR-001"');
        });
        it('says when a story has no independent test', () => {
            expect(lines(out, 'lg-sp-story')[1]).toContain('No independent test written.');
        });
        it('shows progress and built-by only when tasks are given', () => {
            expect(card).not.toContain('Built by');
            setSpecLedgerTasks('- [x] T001 [US1] a FR-001\n- [ ] T002 [US1] b\n- [x] T003 [US1] c');
            const withTasks = lines(preprocessSpecLedger(SPEC), 'lg-sp-story');
            expect(withTasks[0]).toContain('2/3');
            expect(withTasks[0]).toContain('T001 – T003');
            expect(withTasks[1]).toContain('Built by no tasks yet');
        });
    });

    describe('RequirementRow', () => {
        const out = preprocessSpecLedger(SPEC);
        it('emits one row per requirement with an anchor, MUST in weight, and a suffixed id', () => {
            const rows = lines(out, 'lg-sp-req ');
            expect(rows).toHaveLength(3);
            expect(rows[0]).toContain('id="ref-fr-001"');
            expect(rows[0]).toContain('<strong>MUST</strong>');
            expect(rows[2]).toContain('id="ref-fr-009a"');
            expect(rows[2]).not.toContain('**');
        });
        it('lists who references a requirement', () => {
            expect(lines(out, 'lg-sp-req ')[0]).toContain('Referenced by');
            expect(lines(out, 'lg-sp-req ')[1]).not.toContain('Referenced by');
        });
        it('shows coverage once tasks are known', () => {
            expect(lines(out, 'lg-sp-req ')[0]).not.toContain('Covered');
            setSpecLedgerTasks('- [x] T001 [US1] build FR-001');
            const rows = lines(preprocessSpecLedger(SPEC), 'lg-sp-req ');
            expect(rows[0]).toContain('Covered');
            expect(rows[1]).toContain('Untested');
        });
        it('adds a row for a requirement id the spec names but never defines', () => {
            const md = SPEC.replace('(FR-001).', '(FR-031).');
            expect(lines(preprocessSpecLedger(md), 'lg-sp-unresolved')[0]).toContain('FR-031');
        });
    });

    describe('SuccessCriteria', () => {
        const out = preprocessSpecLedger(SPEC);
        it('pulls the numbers into mono and strikes a withdrawn criterion', () => {
            const [measured, withdrawn] = lines(out, 'lg-sp-sc ');
            expect(measured).toContain('<strong class="lg-sp-num">5 seconds</strong>');
            expect(measured).toContain('Proves');
            expect(withdrawn).toContain('lg-sp-withdrawn');
            expect(withdrawn).toContain('withdrawn</span>');
        });
        it('drops the Measurable Outcomes sub-heading', () => {
            expect(out).not.toContain('Measurable Outcomes');
        });
    });

    describe('EdgeCaseList and AssumptionList', () => {
        const out = preprocessSpecLedger(SPEC);
        it('numbers edge cases and splits trigger from outcome', () => {
            const [first] = lines(out, 'lg-sp-edge ');
            expect(first).toContain('EC-1');
            expect(first).toContain('A period crosses a daylight-saving change');
            expect(first).toContain('→ times stay in order');
        });
        it('uses the agreed status words', () => {
            expect(out).toContain('No scenario');
            const covered = SPEC.replace('status is text as well as color', 'a period crossing a daylight-saving change keeps times in order');
            expect(preprocessSpecLedger(covered)).toContain('Covered by a scenario');
        });
        it('marks an assumption as assumed unless it names the answer', () => {
            expect(lines(out, 'lg-sp-assume')[0]).toContain('Assumed');
            const confirmed = preprocessSpecLedger(SPEC.replace('by default.', 'by default (confirmed in Q1).'));
            expect(lines(confirmed, 'lg-sp-assume')[0]).toContain('Confirmed');
        });
    });

    describe('EntityGlossary, VerbatimList, ClarificationList', () => {
        const out = preprocessSpecLedger(SPEC);
        it('renders entities with the requirements that use them', () => {
            const md = SPEC.replace('The Overview MUST show all metrics.', 'The Overview metric MUST show all metrics.');
            expect(lines(preprocessSpecLedger(md), 'lg-sp-entity')[0]).toContain('used by');
            expect(lines(out, 'lg-sp-entity')[0]).toContain('Overview metric');
        });
        it('quotes the input verbatim without the label', () => {
            const quote = lines(out, 'lg-sp-verbatim')[0];
            expect(quote).toContain('“uma interface web nova”');
            expect(quote).not.toContain('User description');
        });
        it('shows answered and open questions in a session fold', () => {
            const fold = lines(out, 'lg-sp-clars')[0];
            expect(fold).toContain('1 answered · 1 open');
            expect(fold).toContain('Q1');
            expect(fold).toContain('Answered');
            expect(fold).toContain('Open');
            expect(fold).toContain('<details class="lg-sp-clarfold" open>');
        });
        it('reads a question whose answer arrow sits on a following line', () => {
            const md = '# Spec\n\n## Requirements\n\n- **FR-001**: x MUST y\n\n## Clarifications\n\n### Session 2026-08-03\n\n- **Q1**: How long may it block?\n  **→ A: Immediate miss.** *Rationale*: it is safe.\n';
            const fold = lines(preprocessSpecLedger(md), 'lg-sp-clars')[0] ?? '';
            expect(fold).toContain('How long may it block?');
            expect(fold).toContain('Immediate miss.');
            expect(fold).not.toContain('**');
        });
    });

    describe('safety', () => {
        it('escapes markup in titles, requirements and the input', () => {
            const md = SPEC.replace('See the health at a glance', '<img src=x onerror=alert(1)>').replace('uma interface web nova', '<script>x</script>').replace('MUST show all metrics', 'MUST show <b onclick=1>');
            const out = preprocessSpecLedger(md);
            expect(out).not.toMatch(/<img src=x|<script>|<b onclick/);
        });
    });

    describe('splitScenario', () => {
        it('splits plain and bold Given / When / Then with And steps', () => {
            const steps = splitScenario('Given a, when b, then c, and d');
            expect(steps.map((s) => s.kw)).toEqual(['given', 'when', 'then', 'and']);
            expect(splitScenario('Something free-form')).toEqual([{ kw: '', text: 'Something free-form' }]);
        });
    });

    describe('parseTasks', () => {
        it('reads id, state, story marker and requirement ids', () => {
            expect(parseTasks('- [x] T001 [P] [US2] Do it for FR-007 and SC-002')).toEqual([{ id: 'T001', done: true, story: 2, refs: ['FR-007', 'SC-002'] }]);
        });
    });

    describe('through renderMarkdown', () => {
        it('renders every component as a commentable line with no raw markup left', () => {
            const html = renderMarkdown(SPEC);
            expect(html).toContain('lg-sp-header');
            expect(html).toContain('lg-sp-story');
            expect(html).toContain('class="line component-line"');
            expect(html).not.toContain('**');
            expect(html).not.toContain('&lt;div');
            expect(html).not.toContain('(mandatory)');
        });
    });
});

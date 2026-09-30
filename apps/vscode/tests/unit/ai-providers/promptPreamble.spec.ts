import {
    renderPreamble,
    renderLifecyclePreamble,
    renderSpecifyCreationLifecyclePreamble,
} from '../../../src/ai-providers/promptPreamble';

const DISPATCH = '2026-06-18T10:30:00Z';
const SPEC_DIR = 'specs/352-family-aware-preamble';

// Markers of the full shared protocol prose the slim companion path must drop.
const SCHEMA_MARKER = '"required": ["workflow"';
const STATUS_LIFECYCLE_MARKER = 'Canonical statuses: draft →';
const SHARED_RULES_MARKER = 'AUTHORSHIP:';

describe('renderPreamble — per-family slim/full split', () => {
    describe('companion command dispatch (slim)', () => {
        const slim = renderPreamble('plan', SPEC_DIR, DISPATCH, true);

        it('keeps the dynamic dispatch context', () => {
            expect(slim).toContain(DISPATCH);                       // real dispatch timestamp
            expect(slim).toContain(`${SPEC_DIR}/.spec-context.json`); // feature dir / target
        });

        it('keeps the next-step-start guard', () => {
            expect(slim).toContain('Leave currentStep on "plan"');
            expect(slim).toContain('phantom "Generating <next>…"');
        });

        it('drops the protocol prose the command body already carries', () => {
            expect(slim).not.toContain(SCHEMA_MARKER);
            expect(slim).not.toContain(STATUS_LIFECYCLE_MARKER);
            expect(slim).not.toContain(SHARED_RULES_MARKER);
        });

        it('is materially shorter than the full stock preamble', () => {
            const full = renderPreamble('plan', SPEC_DIR, DISPATCH, false);
            expect(slim.length).toBeLessThan(full.length);
        });
    });

    describe('stock command dispatch (full)', () => {
        const fullPlan = renderPreamble('plan', SPEC_DIR, DISPATCH, false);

        it('carries the full capture protocol', () => {
            expect(fullPlan).toContain(SCHEMA_MARKER);
            expect(fullPlan).toContain(STATUS_LIFECYCLE_MARKER);
            expect(fullPlan).toContain(SHARED_RULES_MARKER);
        });

        it('references the --advance verb for an advancing step (plan)', () => {
            expect(fullPlan).toContain('--step plan --advance --by ai');
            expect(fullPlan).not.toContain('--step plan --finish');
        });

        it('uses --advance for specify and tasks too', () => {
            expect(renderPreamble('specify', SPEC_DIR, DISPATCH, false))
                .toContain('--step specify --advance --by ai');
            expect(renderPreamble('tasks', SPEC_DIR, DISPATCH, false))
                .toContain('--step tasks --advance --by ai');
        });

        it('uses --finish (not --advance) for a finish-only step (clarify)', () => {
            const fullClarify = renderPreamble('clarify', SPEC_DIR, DISPATCH, false);
            expect(fullClarify).toContain('--step clarify --finish --by ai');
            expect(fullClarify).not.toContain('--step clarify --advance');
        });
    });
});

describe('renderLifecyclePreamble — per-family split', () => {
    it('companion run gets a slim lifecycle body (no duplicated protocol)', () => {
        const slim = renderLifecyclePreamble(SPEC_DIR, DISPATCH, true);
        expect(slim).not.toContain(SCHEMA_MARKER);
        expect(slim).not.toContain(STATUS_LIFECYCLE_MARKER);
        expect(slim).not.toContain(SHARED_RULES_MARKER);
    });

    it('companion run defers self-close to the body — never instructs --advance (the companion path is finish-only, hook-owned status)', () => {
        const slim = renderLifecyclePreamble(SPEC_DIR, DISPATCH, true);
        expect(slim).not.toContain('--advance');
    });

    it('stock run gets the full lifecycle body referencing --advance', () => {
        const full = renderLifecyclePreamble(SPEC_DIR, DISPATCH, false);
        expect(full).toContain(SCHEMA_MARKER);
        expect(full).toContain('--advance --by ai');
    });
});

describe('renderLifecyclePreamble — unattended auto finishes to completed (no approval gate)', () => {
    const AUTO_MARKER = 'UNATTENDED AUTO RUN';

    it('stock auto run is told to mark-complete itself', () => {
        const auto = renderLifecyclePreamble(SPEC_DIR, DISPATCH, false, undefined, true);
        expect(auto).toContain(AUTO_MARKER);
        expect(auto).toContain('--mark-complete --by ai');
    });

    it('companion auto run also carries the finish clause (slim body + finish)', () => {
        const auto = renderLifecyclePreamble(SPEC_DIR, DISPATCH, true, undefined, true);
        expect(auto).toContain(AUTO_MARKER);
        expect(auto).toContain('--mark-complete --by ai');
    });

    it('a NON-auto (attended) run keeps the final gate — no self-complete instruction', () => {
        expect(renderLifecyclePreamble(SPEC_DIR, DISPATCH, false)).not.toContain(AUTO_MARKER);
        expect(renderLifecyclePreamble(SPEC_DIR, DISPATCH, true)).not.toContain(AUTO_MARKER);
    });

    it('the single-step Create dispatch never self-completes', () => {
        expect(renderSpecifyCreationLifecyclePreamble('speckit', SPEC_DIR, DISPATCH, false)).not.toContain(AUTO_MARKER);
        expect(renderSpecifyCreationLifecyclePreamble('companion', SPEC_DIR, DISPATCH, true)).not.toContain(AUTO_MARKER);
    });
});

describe('renderSpecifyCreationLifecyclePreamble — install-state split', () => {
    it('companion-installed create dispatch gets the slim lifecycle body', () => {
        const slim = renderSpecifyCreationLifecyclePreamble('companion', SPEC_DIR, DISPATCH, true);
        expect(slim).not.toContain(SCHEMA_MARKER);
        expect(slim).not.toContain(SHARED_RULES_MARKER);
    });

    it('stock create dispatch gets the full lifecycle body', () => {
        const full = renderSpecifyCreationLifecyclePreamble('speckit', SPEC_DIR, DISPATCH, false);
        expect(full).toContain(SCHEMA_MARKER);
        expect(full).toContain('--advance --by ai');
    });
});

describe('renderSpecifyCreationLifecyclePreamble — spec dir unknown at dispatch', () => {
    const ORDER_RULE = 'Run NO write-context.py call before the command has created `specs/<NNN>-<slug>/` and written `.specify/feature.json`.';
    const PREVIOUS_SPEC_RULE = 'Never run these against a folder that already has history. That is the previous spec.';
    const UNKNOWN_DIR_FLAG = '--feature-dir "<the folder the command just created>"';

    it('stock create orders every writer call after the folder exists and scopes it to that folder', () => {
        const out = renderSpecifyCreationLifecyclePreamble('speckit', null, DISPATCH, false);
        expect(out).toContain(ORDER_RULE);
        expect(out).toContain(PREVIOUS_SPEC_RULE);
        expect(out).toContain('Write the seed file inside that folder, only after the command has created it and written `.specify/feature.json`.');
        // The self-close, the captures and the per-task journal all carry the flag: a bare call resolves to the previous spec.
        expect(out).toMatch(new RegExp(`${UNKNOWN_DIR_FLAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} --step <step> --advance --by ai`));
        expect(out).toMatch(/--feature-dir "<the folder the command just created>" --coverage-req FR-NNN/);
        expect(out).toMatch(/--feature-dir "<the folder the command just created>" --task <TaskID> --kind complete --by ai/);
        // No rendered writer call is left unscoped.
        expect(out).not.toMatch(/python3 "[^"]+" --step/);
        expect(out).not.toMatch(/python3 "[^"]+" --coverage-req/);
        expect(out).not.toMatch(/python3 "[^"]+" --set/);
    });

    it('a known dir renders the real flag and none of the unknown-dir prose', () => {
        const out = renderSpecifyCreationLifecyclePreamble('speckit', SPEC_DIR, DISPATCH, false);
        expect(out).toContain(`--feature-dir "${SPEC_DIR}" --step <step> --advance --by ai`);
        expect(out).not.toContain(ORDER_RULE);
        expect(out).not.toContain(PREVIOUS_SPEC_RULE);
        expect(out).not.toContain(UNKNOWN_DIR_FLAG);
    });

    it('the companion (slim) create body is unchanged by the unknown dir', () => {
        const out = renderSpecifyCreationLifecyclePreamble('companion', null, DISPATCH, true);
        expect(out).not.toContain(ORDER_RULE);
        expect(out).not.toContain(UNKNOWN_DIR_FLAG);
        expect(out).toContain('carries the full `.spec-context.json` capture');
    });

    it('the multi-step lifecycle preamble applies the same rule when the dir is unknown', () => {
        const out = renderLifecyclePreamble('', DISPATCH, false);
        expect(out).toContain(ORDER_RULE);
        expect(out).toContain(UNKNOWN_DIR_FLAG);
        expect(renderLifecyclePreamble(SPEC_DIR, DISPATCH, false)).not.toContain(ORDER_RULE);
    });
});

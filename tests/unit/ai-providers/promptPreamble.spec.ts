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

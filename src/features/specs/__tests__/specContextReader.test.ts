/**
 * Tests for `normalizeSpecContext` — focused on the spec-095 contract that
 * inbound `task_summaries[*].concerns` and `.files` are coerced into the
 * canonical `string[]` shape (or omitted), so the extension → webview
 * boundary always passes typed data to `TasksCard`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeSpecContext } from '../specContextReader';

describe('normalizeSpecContext — task_summaries coercion', () => {
    it('passes a canonical string[] concerns through unchanged', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: {
                T001: { status: 'DONE', concerns: ['valid one', 'valid two'] },
            },
        });
        const summaries = ctx.task_summaries as Record<string, { concerns?: unknown }>;
        expect(summaries.T001.concerns).toEqual(['valid one', 'valid two']);
    });

    it('coerces the literal "None" concerns string into an empty array', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: { T001: { status: 'DONE', concerns: 'None' } },
        });
        const summaries = ctx.task_summaries as Record<string, { concerns?: unknown }>;
        expect(summaries.T001.concerns).toEqual([]);
    });

    it('coerces an empty string and "N/A" into an empty array', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: {
                T001: { status: 'DONE', concerns: '' },
                T002: { status: 'DONE', concerns: 'N/A' },
                T003: { status: 'DONE', concerns: '   ' },
            },
        });
        const summaries = ctx.task_summaries as Record<string, { concerns?: unknown }>;
        expect(summaries.T001.concerns).toEqual([]);
        expect(summaries.T002.concerns).toEqual([]);
        expect(summaries.T003.concerns).toEqual([]);
    });

    it('wraps an arbitrary non-empty string as a single-entry array (trimmed)', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: {
                T001: { status: 'DONE', concerns: '  Fees-Tax excluded  ' },
            },
        });
        const summaries = ctx.task_summaries as Record<string, { concerns?: unknown }>;
        expect(summaries.T001.concerns).toEqual(['Fees-Tax excluded']);
    });

    it('drops concerns when value is null or a non-string non-array primitive', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: {
                T001: { status: 'DONE', concerns: null },
                T002: { status: 'DONE', concerns: 42 },
            },
        });
        const summaries = ctx.task_summaries as Record<string, Record<string, unknown>>;
        expect('concerns' in summaries.T001).toBe(false);
        expect('concerns' in summaries.T002).toBe(false);
    });

    it('leaves entries with concerns absent untouched (no key injected)', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: { T001: { status: 'DONE', did: 'something' } },
        });
        const summaries = ctx.task_summaries as Record<string, Record<string, unknown>>;
        expect('concerns' in summaries.T001).toBe(false);
        expect(summaries.T001.did).toBe('something');
    });

    it('applies the same coercion rules to `files`', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: {
                T001: { status: 'DONE', files: 'path/to/one.ts' },
                T002: { status: 'DONE', files: ['a.ts', 'b.ts'] },
                T003: { status: 'DONE', files: 'None' },
            },
        });
        const summaries = ctx.task_summaries as Record<string, { files?: unknown }>;
        expect(summaries.T001.files).toEqual(['path/to/one.ts']);
        expect(summaries.T002.files).toEqual(['a.ts', 'b.ts']);
        expect(summaries.T003.files).toEqual([]);
    });

    it('preserves unknown top-level and per-entry fields (FR-013)', () => {
        const ctx = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            customTopLevel: 'preserved',
            task_summaries: {
                T001: {
                    status: 'DONE',
                    concerns: 'None',
                    customPerEntry: 'preserved',
                },
            },
        });
        expect((ctx as Record<string, unknown>).customTopLevel).toBe('preserved');
        const summaries = ctx.task_summaries as Record<string, Record<string, unknown>>;
        expect(summaries.T001.customPerEntry).toBe('preserved');
        expect(summaries.T001.status).toBe('DONE');
    });

    it('handles missing/null/non-object task_summaries gracefully', () => {
        const a = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
        });
        expect(a.task_summaries).toBeUndefined();

        const b = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: null,
        });
        expect(b.task_summaries).toBeNull();

        const c = normalizeSpecContext({
            currentStep: 'implement',
            status: 'implementing',
            stepHistory: {},
            transitions: [],
            task_summaries: 'oops',
        });
        expect(c.task_summaries).toBe('oops');
    });

    it('regression: FIRM-11132 fixture is fully coerced after normalization', () => {
        const fixturePath = path.join(
            __dirname,
            '../../../../specs/095-fix-tasks-card-concerns/fixtures/firm-11132.spec-context.json',
        );
        const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as Record<string, unknown>;

        const ctx = normalizeSpecContext(raw);
        const summaries = ctx.task_summaries as Record<string, { concerns?: unknown; files?: unknown }>;

        expect(Object.keys(summaries).sort()).toEqual(['RT1', 'RT2', 'RT3', 'T001-T004']);

        for (const id of Object.keys(summaries)) {
            const entry = summaries[id];
            expect(Array.isArray(entry.concerns) || entry.concerns === undefined).toBe(true);
            expect(Array.isArray(entry.files) || entry.files === undefined).toBe(true);
        }

        // The two "None" entries should normalize to [].
        expect(summaries.RT1.concerns).toEqual([]);
        expect(summaries.RT3.concerns).toEqual([]);
        // The substantive concern strings should normalize to single-entry arrays.
        expect(summaries['T001-T004'].concerns).toEqual([
            'Spec Exploration Findings were wrong — superseded by RT1-RT3',
        ]);
        expect((summaries.RT2.concerns as string[])[0]).toContain('Fees-Tax');
    });
});

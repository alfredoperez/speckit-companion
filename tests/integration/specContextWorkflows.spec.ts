import * as fs from 'fs';
import * as path from 'path';
import {
    normalizeSpecContext,
    validateSpecContext,
} from '../../src/features/specs/specContextReader';
import {
    setStepStarted,
    setStepCompleted,
} from '../../src/features/specs/specContextWriter';
import { backfillMinimalContext } from '../../src/features/specs/specContextBackfill';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'spec-context');

function loadFixture(name: string): unknown {
    return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8'));
}

describe('spec-context workflow integration (SC-001, US3)', () => {
    it('validates canonical fixture 054 against tolerant validator', () => {
        const { valid } = validateSpecContext(normalizeSpecContext(loadFixture('054.json') as Record<string, unknown>));
        expect(valid).toBe(true);
    });

    it('migrates legacy 055 (status-only); after backfill of identity fields, validates', () => {
        const migrated = normalizeSpecContext(loadFixture('055.json') as Record<string, unknown>);
        expect(migrated.status).toBe('completed');
        expect(migrated.stepHistory).toEqual({});
        // 055 lacks identity fields — a subsequent backfill fills them in.
        const backfilled = { ...migrated, specName: '055-fix-bullet-rendering', branch: '055-fix-bullet-rendering' };
        expect(validateSpecContext(backfilled).valid).toBe(true);
    });

    it('validates SDD-Fast fixture 056', () => {
        const ctx = normalizeSpecContext(loadFixture('056.json') as Record<string, unknown>);
        expect(validateSpecContext(ctx).valid).toBe(true);
        expect(ctx.status).toBe('specifying');
    });

    it('validates contradictory-looking fixture 058 (migration does not invent data)', () => {
        const ctx = normalizeSpecContext(loadFixture('058.json') as Record<string, unknown>);
        expect(validateSpecContext(ctx).valid).toBe(true);
        // Preserved as-authored; viewer state will reflect the contradiction.
        expect(ctx.status).toBe('completed');
        expect(ctx.stepHistory.tasks.completedAt).toBeNull();
    });
});

describe('specify → plan → tasks simulation (US7 via T007 helpers)', () => {
    it('final context has startedAt+completedAt for all three steps and ≥ 6 transitions', () => {
        let ctx = backfillMinimalContext({
            workflow: 'speckit-companion',
            specName: 'sim',
            branch: 'main',
        });
        ctx = setStepStarted(ctx, 'specify', 'extension');
        ctx = setStepCompleted(ctx, 'specify', 'extension');
        ctx = setStepStarted(ctx, 'plan', 'extension');
        ctx = setStepCompleted(ctx, 'plan', 'extension');
        ctx = setStepStarted(ctx, 'tasks', 'extension');
        ctx = setStepCompleted(ctx, 'tasks', 'extension');

        for (const s of ['specify', 'plan', 'tasks'] as const) {
            expect(ctx.stepHistory[s].startedAt).toBeTruthy();
            expect(ctx.stepHistory[s].completedAt).toBeTruthy();
        }
        expect(ctx.transitions.length).toBeGreaterThanOrEqual(6);
    });
});

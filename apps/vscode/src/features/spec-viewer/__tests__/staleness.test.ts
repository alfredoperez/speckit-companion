import * as vscode from 'vscode';
import { computeStaleness } from '../staleness';
import type { SpecDocument } from '../types';

const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>;

beforeEach(() => {
    jest.clearAllMocks();
    (mockFs.stat as jest.Mock).mockRejectedValue(new Error('not found'));
});

/**
 * Helper: build a SpecDocument with sensible defaults.
 */
function makeDoc(overrides: Partial<SpecDocument> & Pick<SpecDocument, 'type' | 'label' | 'filePath'>): SpecDocument {
    return {
        fileName: overrides.filePath.split('/').pop()!,
        exists: true,
        isCore: true,
        category: 'core',
        ...overrides,
    };
}

/**
 * Helper: configure stat to return controlled mtimes keyed by file path.
 */
function mockMtimes(mapping: Record<string, number>) {
    (mockFs.stat as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath in mapping) {
            return { type: vscode.FileType.File, size: 100, mtime: mapping[uri.fsPath], ctime: 0 };
        }
        throw new Error('not found');
    });
}

const SPEC_PATH = '/workspace/specs/feat/spec.md';
const PLAN_PATH = '/workspace/specs/feat/plan.md';
const TASKS_PATH = '/workspace/specs/feat/tasks.md';

describe('computeStaleness', () => {
    it('should mark the first document as not stale', async () => {
        mockMtimes({ [SPEC_PATH]: 10_000 });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['spec']).toEqual({
            isStale: false,
            staleReason: '',
            newerUpstream: '',
        });
    });

    it('should mark a doc as stale when upstream has a newer mtime', async () => {
        mockMtimes({
            [SPEC_PATH]: 20_000,
            [PLAN_PATH]: 10_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['plan'].isStale).toBe(true);
        expect(result['plan'].newerUpstream).toBe('Spec');
        expect(result['plan'].staleReason).toContain('Plan');
        expect(result['plan'].staleReason).toContain('spec');
    });

    it('should not mark a doc as stale when upstream has an older mtime', async () => {
        mockMtimes({
            [SPEC_PATH]: 10_000,
            [PLAN_PATH]: 20_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['plan']).toEqual({
            isStale: false,
            staleReason: '',
            newerUpstream: '',
        });
    });

    it('should not mark a non-existent doc as stale', async () => {
        mockMtimes({ [SPEC_PATH]: 20_000 });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH, exists: false }),
        ];

        const result = await computeStaleness(docs);

        expect(result['plan']).toEqual({
            isStale: false,
            staleReason: '',
            newerUpstream: '',
        });
    });

    it('should mark both plan and tasks as stale when spec is newest (cascading)', async () => {
        mockMtimes({
            [SPEC_PATH]: 30_000,
            [PLAN_PATH]: 10_000,
            [TASKS_PATH]: 20_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
            makeDoc({ type: 'tasks', label: 'Tasks', filePath: TASKS_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['spec'].isStale).toBe(false);
        expect(result['plan'].isStale).toBe(true);
        expect(result['plan'].newerUpstream).toBe('Spec');
        expect(result['tasks'].isStale).toBe(true);
        expect(result['tasks'].newerUpstream).toBe('Spec');
    });

    it('should detect staleness from only the immediate predecessor when it is newer', async () => {
        mockMtimes({
            [SPEC_PATH]: 10_000,
            [PLAN_PATH]: 30_000,
            [TASKS_PATH]: 20_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
            makeDoc({ type: 'tasks', label: 'Tasks', filePath: TASKS_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['spec'].isStale).toBe(false);
        expect(result['plan'].isStale).toBe(false);
        expect(result['tasks'].isStale).toBe(true);
        expect(result['tasks'].newerUpstream).toBe('Plan');
    });

    it('should not mark a doc as stale when mtimes are equal', async () => {
        mockMtimes({
            [SPEC_PATH]: 10_000,
            [PLAN_PATH]: 10_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['plan']).toEqual({
            isStale: false,
            staleReason: '',
            newerUpstream: '',
        });
    });

    it('should not mark a doc as stale when upstream is newer by only a burst of writes', async () => {
        mockMtimes({
            [SPEC_PATH]: 10_400,
            [PLAN_PATH]: 10_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
        ];

        const result = await computeStaleness(docs);

        expect(result['plan'].isStale).toBe(false);
    });

    it('should ignore non-core docs entirely', async () => {
        const RESEARCH_PATH = '/workspace/specs/feat/research.md';
        mockMtimes({
            [SPEC_PATH]: 10_000,
            [RESEARCH_PATH]: 50_000,
            [PLAN_PATH]: 20_000,
        });

        const docs = [
            makeDoc({ type: 'spec', label: 'Spec', filePath: SPEC_PATH }),
            makeDoc({ type: 'research', label: 'Research', filePath: RESEARCH_PATH, isCore: false, category: 'related' }),
            makeDoc({ type: 'plan', label: 'Plan', filePath: PLAN_PATH }),
        ];

        const result = await computeStaleness(docs);

        // Non-core doc should not appear in the staleness map
        expect(result['research']).toBeUndefined();
        // Plan should not be stale since spec < plan
        expect(result['plan'].isStale).toBe(false);
    });
});

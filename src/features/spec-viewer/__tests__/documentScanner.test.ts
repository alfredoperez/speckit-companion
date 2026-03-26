import * as vscode from 'vscode';
import { scanDocuments } from '../documentScanner';
import type { WorkflowStepConfig } from '../../workflows/types';

const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>;

const SPEC_DIR = '/workspace/specs/my-feature';

const outputChannel = {
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
} as unknown as vscode.OutputChannel;

beforeEach(() => {
    jest.clearAllMocks();
    // Default: all files exist, no directory entries
    (mockFs.stat as jest.Mock).mockRejectedValue(new Error('not found'));
    (mockFs.readDirectory as jest.Mock).mockResolvedValue([]);
});

/**
 * Helper: make stat succeed for specific file paths.
 */
function mockFileExists(...paths: string[]) {
    const pathSet = new Set(paths);
    (mockFs.stat as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
        if (pathSet.has(uri.fsPath)) {
            return { type: vscode.FileType.File, size: 100 };
        }
        throw new Error('not found');
    });
}

/**
 * Helper: configure readDirectory results keyed by directory path.
 */
function mockReadDirectory(mapping: Record<string, [string, vscode.FileType][]>) {
    (mockFs.readDirectory as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
        return mapping[uri.fsPath] ?? [];
    });
}

describe('scanDocuments - parentStep assignment for orphan related docs', () => {
    const baseSteps: WorkflowStepConfig[] = [
        { name: 'specify', label: 'Specify', command: 'speckit.specify', file: 'spec.md' },
        { name: 'plan', label: 'Plan', command: 'speckit.plan', file: 'plan.md' },
        { name: 'implement', label: 'Implement', command: 'speckit.implement', actionOnly: true },
    ];

    it('should assign orphan doc via subFiles match', async () => {
        const steps: WorkflowStepConfig[] = [
            { ...baseSteps[0] },
            { ...baseSteps[1], subFiles: ['research.md'] },
            { ...baseSteps[2] },
        ];

        // Core files exist
        mockFileExists(
            `${SPEC_DIR}/spec.md`,
            `${SPEC_DIR}/plan.md`,
        );

        // Spec directory has an extra related doc: research.md
        mockReadDirectory({
            [SPEC_DIR]: [
                ['spec.md', vscode.FileType.File],
                ['plan.md', vscode.FileType.File],
                ['research.md', vscode.FileType.File],
            ],
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel, steps);

        const researchDoc = docs.find(d => d.fileName === 'research.md');
        expect(researchDoc).toBeDefined();
        expect(researchDoc!.parentStep).toBe('plan');
    });

    it('should assign orphan doc via includeRelatedDocs step when no subFiles match', async () => {
        const steps: WorkflowStepConfig[] = [
            { ...baseSteps[0] },
            { ...baseSteps[1], includeRelatedDocs: true },
            { ...baseSteps[2] },
        ];

        mockFileExists(
            `${SPEC_DIR}/spec.md`,
            `${SPEC_DIR}/plan.md`,
        );

        mockReadDirectory({
            [SPEC_DIR]: [
                ['spec.md', vscode.FileType.File],
                ['plan.md', vscode.FileType.File],
                ['notes.md', vscode.FileType.File],
            ],
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel, steps);

        const notesDoc = docs.find(d => d.fileName === 'notes.md');
        expect(notesDoc).toBeDefined();
        expect(notesDoc!.parentStep).toBe('plan');
    });

    it('should fall back to second content step when no subFiles or includeRelatedDocs', async () => {
        // 3 content steps + 1 actionOnly, no subFiles or includeRelatedDocs
        const steps: WorkflowStepConfig[] = [
            { ...baseSteps[0] },
            { ...baseSteps[1] },
            { name: 'tasks', label: 'Tasks', command: 'speckit.tasks', file: 'tasks.md' },
            { ...baseSteps[2] }, // actionOnly
        ];

        mockFileExists(
            `${SPEC_DIR}/spec.md`,
            `${SPEC_DIR}/plan.md`,
            `${SPEC_DIR}/tasks.md`,
        );

        mockReadDirectory({
            [SPEC_DIR]: [
                ['spec.md', vscode.FileType.File],
                ['plan.md', vscode.FileType.File],
                ['tasks.md', vscode.FileType.File],
                ['random.md', vscode.FileType.File],
            ],
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel, steps);

        const randomDoc = docs.find(d => d.fileName === 'random.md');
        expect(randomDoc).toBeDefined();
        // Falls back to second content step (plan), not last (tasks)
        expect(randomDoc!.parentStep).toBe('plan');
    });

    it('should not reassign parentStep for docs already assigned via subDir scan', async () => {
        const steps: WorkflowStepConfig[] = [
            { ...baseSteps[0], subDir: 'sub-specs' },
            { ...baseSteps[1], includeRelatedDocs: true },
            { ...baseSteps[2] },
        ];

        const subSpecFile = `${SPEC_DIR}/sub-specs/auth/spec.md`;

        // stat: core files + the sub-spec file exist
        mockFileExists(
            `${SPEC_DIR}/spec.md`,
            `${SPEC_DIR}/plan.md`,
            subSpecFile,
        );

        // readDirectory: sub-specs/ has an 'auth' subfolder
        mockReadDirectory({
            [`${SPEC_DIR}/sub-specs`]: [
                ['auth', vscode.FileType.Directory],
            ],
            // recursive scan of spec dir finds core files only (sub-spec is excluded via subDirFiles set)
            [SPEC_DIR]: [
                ['spec.md', vscode.FileType.File],
                ['plan.md', vscode.FileType.File],
            ],
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel, steps);

        const subDoc = docs.find(d => d.type === 'sub-specs/auth');
        expect(subDoc).toBeDefined();
        // Should keep the original parentStep from subDir scan, not reassigned
        expect(subDoc!.parentStep).toBe('specify');
    });
});

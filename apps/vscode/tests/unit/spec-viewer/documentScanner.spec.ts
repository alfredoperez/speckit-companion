import * as vscode from 'vscode';
import { scanDocuments } from '../../../src/features/spec-viewer/documentScanner';

const SPEC_DIR = '/specs/096-scratchpad';

function uriPath(u: unknown): string {
    if (typeof u === 'string') return u;
    const obj = u as { fsPath?: string; path?: string };
    return obj.fsPath ?? obj.path ?? '';
}

interface FakeFs {
    /** Absolute file/dir paths that exist on disk. */
    existing: Set<string>;
    /** Directory path → [name, FileType] entries. */
    dirEntries: Record<string, Array<[string, number]>>;
    /** File path → text contents. */
    contents: Record<string, string>;
}

function installFs(fake: FakeFs): void {
    (vscode.workspace.fs.stat as jest.Mock).mockImplementation(async (u: unknown) => {
        if (fake.existing.has(uriPath(u))) return { type: vscode.FileType.File };
        throw new Error('not found');
    });
    (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(async (u: unknown) => {
        return fake.dirEntries[uriPath(u)] ?? [];
    });
    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (u: unknown) => {
        return Buffer.from(fake.contents[uriPath(u)] ?? '');
    });
}

const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('documentScanner — scratchpad path removed', () => {
    it('does not synthesize any "Notes" / *-extra docs for core source docs', async () => {
        installFs({
            existing: new Set([
                `${SPEC_DIR}/spec.md`,
                `${SPEC_DIR}/plan.md`,
                `${SPEC_DIR}/tasks.md`,
            ]),
            dirEntries: {
                [SPEC_DIR]: [
                    ['spec.md', vscode.FileType.File],
                    ['plan.md', vscode.FileType.File],
                    ['tasks.md', vscode.FileType.File],
                ],
            },
            contents: {},
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel);

        // No synthesized scratchpad/Notes docs.
        expect(docs.some(d => /-extra\.md$/.test(d.fileName))).toBe(false);
        expect(docs.some(d => /Notes$/.test(d.label))).toBe(false);
        // Only the three core docs remain.
        expect(docs.map(d => d.fileName).sort()).toEqual([
            'plan.md',
            'spec.md',
            'tasks.md',
        ]);
    });

    it('filters out legacy on-disk *-extra.md files (not surfaced as a doc)', async () => {
        installFs({
            existing: new Set([
                `${SPEC_DIR}/spec.md`,
                `${SPEC_DIR}/spec-extra.md`,
            ]),
            dirEntries: {
                [SPEC_DIR]: [
                    ['spec.md', vscode.FileType.File],
                    ['spec-extra.md', vscode.FileType.File],
                ],
            },
            contents: { [`${SPEC_DIR}/spec-extra.md`]: 'legacy notes' },
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel);

        expect(docs.some(d => d.fileName === 'spec-extra.md')).toBe(false);
    });
});

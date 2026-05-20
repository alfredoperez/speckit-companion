import * as vscode from 'vscode';
import { scanDocuments } from '../../../src/features/spec-viewer/documentScanner';
import type { SpecDocument } from '../../../src/features/spec-viewer/types';

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

function scratchpads(docs: SpecDocument[]): SpecDocument[] {
    return docs.filter(d => d.isScratchpad);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('documentScanner scratchpad synthesis', () => {
    it('synthesizes one scratchpad per existing core source doc', async () => {
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
        const pads = scratchpads(docs);

        expect(pads.map(d => d.type).sort()).toEqual([
            'plan-extra',
            'spec-extra',
            'tasks-extra',
        ]);
        const spec = pads.find(d => d.type === 'spec-extra')!;
        expect(spec).toMatchObject({
            isScratchpad: true,
            scratchpadFor: 'spec',
            parentStep: 'spec',
            isCore: false,
            category: 'related',
            fileName: 'spec-extra.md',
            exists: false,
        });
    });

    it('does not synthesize a scratchpad when the source doc is absent', async () => {
        installFs({
            existing: new Set([`${SPEC_DIR}/spec.md`]),
            dirEntries: {
                [SPEC_DIR]: [['spec.md', vscode.FileType.File]],
            },
            contents: {},
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel);
        const pads = scratchpads(docs);

        expect(pads.map(d => d.type)).toEqual(['spec-extra']);
    });

    it('surfaces an on-disk *-extra.md exactly once (de-dupe)', async () => {
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
            contents: { [`${SPEC_DIR}/spec-extra.md`]: 'some notes' },
        });

        const docs = await scanDocuments(SPEC_DIR, outputChannel);
        const extras = docs.filter(d => d.fileName === 'spec-extra.md');

        expect(extras).toHaveLength(1);
        expect(extras[0]).toMatchObject({
            type: 'spec-extra',
            isScratchpad: true,
            exists: true,
        });
    });
});

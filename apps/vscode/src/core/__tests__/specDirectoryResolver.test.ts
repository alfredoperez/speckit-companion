import * as vscode from 'vscode';
import {
    resolveSpecDirectories,
    isInsideSpecDirectory,
    getFileWatcherPatterns,
    hasDuplicateNames,
    deriveChangeRoot,
} from '../specDirectoryResolver';

const mockWorkspace = vscode.workspace as jest.Mocked<typeof vscode.workspace>;

function mockConfig(specDirectories: string[]) {
    mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockReturnValue(specDirectories),
    } as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockConfig(['specs']);
    (mockWorkspace.fs.readDirectory as jest.Mock).mockReset().mockResolvedValue([]);
    (mockWorkspace.findFiles as jest.Mock).mockReset().mockResolvedValue([]);
    (mockWorkspace.fs.stat as jest.Mock).mockReset().mockRejectedValue(new Error('not found'));
});

const WORKSPACE = '/workspace';

describe('resolveSpecDirectories', () => {
    describe('simple directory patterns', () => {
        it('discovers spec folders containing .md files', async () => {
            // specs/ contains two subdirectories
            (mockWorkspace.fs.readDirectory as jest.Mock)
                .mockResolvedValueOnce([
                    ['auth', vscode.FileType.Directory],
                    ['login', vscode.FileType.Directory],
                ])
                // auth/ has .md files
                .mockResolvedValueOnce([
                    ['spec.md', vscode.FileType.File],
                ])
                // login/ has .md files
                .mockResolvedValueOnce([
                    ['spec.md', vscode.FileType.File],
                ]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([
                { name: 'auth', path: 'specs/auth' },
                { name: 'login', path: 'specs/login' },
            ]);
        });

        it('skips empty directories with no .md files', async () => {
            (mockWorkspace.fs.readDirectory as jest.Mock)
                .mockResolvedValueOnce([
                    ['auth', vscode.FileType.Directory],
                    ['empty', vscode.FileType.Directory],
                ])
                .mockResolvedValueOnce([
                    ['spec.md', vscode.FileType.File],
                ])
                // empty/ has no .md files
                .mockResolvedValueOnce([]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([
                { name: 'auth', path: 'specs/auth' },
            ]);
        });

        it('skips directories containing only subdirectories but no .md files', async () => {
            (mockWorkspace.fs.readDirectory as jest.Mock)
                .mockResolvedValueOnce([
                    ['nested', vscode.FileType.Directory],
                ])
                // nested/ only has subdirectories
                .mockResolvedValueOnce([
                    ['subdir', vscode.FileType.Directory],
                ]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([]);
        });

        it('deduplicates specs found through multiple patterns', async () => {
            mockConfig(['specs', 'specs']);

            (mockWorkspace.fs.readDirectory as jest.Mock)
                .mockResolvedValueOnce([
                    ['auth', vscode.FileType.Directory],
                ])
                .mockResolvedValueOnce([
                    ['spec.md', vscode.FileType.File],
                ])
                // Second pattern returns the same
                .mockResolvedValueOnce([
                    ['auth', vscode.FileType.Directory],
                ])
                .mockResolvedValueOnce([
                    ['spec.md', vscode.FileType.File],
                ]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([
                { name: 'auth', path: 'specs/auth' },
            ]);
        });
    });

    describe('glob directory patterns', () => {
        it('discovers spec folders matching glob with .md files', async () => {
            mockConfig(['openspec/changes/*/specs/*']);

            (mockWorkspace.findFiles as jest.Mock)
                .mockResolvedValueOnce([
                    vscode.Uri.file('/workspace/openspec/changes/nav/specs/sidebar/spec.md'),
                ])
                .mockResolvedValue([]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([
                { name: 'sidebar', path: 'openspec/changes/nav/specs/sidebar' },
            ]);
        });

        it('skips glob-matched directories without direct .md files', async () => {
            mockConfig(['openspec/changes/*/specs/*']);

            // No .md files found
            (mockWorkspace.findFiles as jest.Mock).mockResolvedValue([]);

            const result = await resolveSpecDirectories(WORKSPACE);

            expect(result).toEqual([]);
        });

        describe('a glob ending in a plain name', () => {
            beforeEach(() => mockConfig(['apps/*/specs']));

            it('lists the spec folders inside each match, not the matches', async () => {
                (mockWorkspace.findFiles as jest.Mock).mockImplementation(async (p: vscode.RelativePattern) =>
                    p.pattern === 'apps/*/specs/*/*.md'
                        ? [vscode.Uri.file('/workspace/apps/a/specs/001-x/spec.md'), vscode.Uri.file('/workspace/apps/b/specs/002-y/spec.md')]
                        : []);

                const result = await resolveSpecDirectories(WORKSPACE);

                expect(result).toEqual([
                    { name: '001-x', path: 'apps/a/specs/001-x' },
                    { name: '002-y', path: 'apps/b/specs/002-y' },
                ]);
            });

            it('lists nothing for a folder of specs that holds no spec yet', async () => {
                (mockWorkspace.findFiles as jest.Mock).mockImplementation(async (p: vscode.RelativePattern) =>
                    p.pattern === 'apps/*/*' ? [vscode.Uri.file('/workspace/apps/a/package.json')] : []);
                (mockWorkspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });

                expect(await resolveSpecDirectories(WORKSPACE)).toEqual([]);
            });
        });

        it('leaves an OpenSpec archive folder unexpanded under a wildcard-ending glob', async () => {
            mockConfig(['openspec/changes/*']);
            (mockWorkspace.findFiles as jest.Mock).mockImplementation(async (p: vscode.RelativePattern) => {
                if (p.pattern === 'openspec/changes/*/*.md') { return [vscode.Uri.file('/workspace/openspec/changes/nav/proposal.md')]; }
                if (p.pattern === 'openspec/changes/*/**/*.md') { return [vscode.Uri.file('/workspace/openspec/changes/archive/2026-01-01-old/proposal.md')]; }
                return [];
            });

            expect(await resolveSpecDirectories(WORKSPACE)).toEqual([
                { name: 'nav', path: 'openspec/changes/nav' },
            ]);
        });
    });
});

describe('isInsideSpecDirectory', () => {
    it('returns spec path for files inside a configured spec directory', () => {
        const result = isInsideSpecDirectory(
            '/workspace/specs/auth/spec.md',
            WORKSPACE,
        );
        expect(result).toBe('specs/auth');
    });

    it('returns undefined for files outside spec directories', () => {
        const result = isInsideSpecDirectory(
            '/workspace/src/main.ts',
            WORKSPACE,
        );
        expect(result).toBeUndefined();
    });

    it('handles glob patterns correctly', () => {
        mockConfig(['openspec/changes/*/specs/*']);

        const result = isInsideSpecDirectory(
            '/workspace/openspec/changes/nav/specs/sidebar/spec.md',
            WORKSPACE,
        );
        expect(result).toBe('openspec/changes/nav/specs/sidebar');
    });

    it('reads a trailing slash on a glob ending in a plain name the same as without one', () => {
        mockConfig(['apps/*/specs/']);
        expect(isInsideSpecDirectory('/workspace/apps/a/specs/001-x/spec.md', WORKSPACE))
            .toBe('apps/a/specs/001-x');
    });

    it('attributes a file to the spec folder inside a glob ending in a plain name', () => {
        mockConfig(['apps/*/specs']);
        expect(isInsideSpecDirectory('/workspace/apps/a/specs/001-x/checklists/requirements.md', WORKSPACE))
            .toBe('apps/a/specs/001-x');
    });
});

describe('deriveChangeRoot', () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const os = jest.requireActual('os') as typeof import('os');
    const path = jest.requireActual('path') as typeof import('path');
    let root: string;

    beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'change-root-')); });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('returns the change folder above a specs segment', () => {
        mockConfig(['features/*/specs/*']);
        expect(deriveChangeRoot(path.join(root, 'features/login/specs/form'), root))
            .toBe(path.join(root, 'features/login'));
    });

    it('does not treat a project holding a folder of specs as a change root', () => {
        mockConfig(['apps/*/specs']);
        expect(deriveChangeRoot(path.join(root, 'apps/a/specs/001-x'), root)).toBeNull();
    });
});

describe('directoryHasMarkdown (tested indirectly via resolveSpecDirectories)', () => {
    it('includes directory when it contains .md files', async () => {
        const readDir = mockWorkspace.fs.readDirectory as jest.Mock;
        readDir.mockReset();
        readDir.mockImplementation(async (uri: vscode.Uri) => {
            if (uri.fsPath.endsWith('/specs')) {
                return [['feature', vscode.FileType.Directory]];
            }
            if (uri.fsPath.endsWith('/feature')) {
                return [['spec.md', vscode.FileType.File]];
            }
            return [];
        });

        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toHaveLength(1);
    });

    it('excludes directory when it is empty', async () => {
        const readDir = mockWorkspace.fs.readDirectory as jest.Mock;
        readDir.mockReset();
        readDir.mockImplementation(async (uri: vscode.Uri) => {
            if (uri.fsPath.endsWith('/specs')) {
                return [['feature', vscode.FileType.Directory]];
            }
            return [];
        });

        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toHaveLength(0);
    });

    it('excludes directory when it contains only non-.md files', async () => {
        const readDir = mockWorkspace.fs.readDirectory as jest.Mock;
        readDir.mockReset();
        readDir.mockImplementation(async (uri: vscode.Uri) => {
            if (uri.fsPath.endsWith('/specs')) {
                return [['feature', vscode.FileType.Directory]];
            }
            if (uri.fsPath.endsWith('/feature')) {
                return [['notes.txt', vscode.FileType.File]];
            }
            return [];
        });

        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toHaveLength(0);
    });

    it('excludes directory when parent does not exist', async () => {
        const readDir = mockWorkspace.fs.readDirectory as jest.Mock;
        readDir.mockReset();
        readDir.mockRejectedValue(new Error('ENOENT'));

        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toHaveLength(0);
    });
});

describe('getFileWatcherPatterns', () => {
    it('generates spec/task/markdown/specContext patterns for each configured directory', () => {
        mockConfig(['specs', 'docs']);

        const result = getFileWatcherPatterns();

        expect(result).toEqual({
            specs: ['**/specs/**/*', '**/docs/**/*'],
            tasks: ['**/specs/**/tasks.md', '**/docs/**/tasks.md'],
            markdown: ['**/specs/**/*.md', '**/docs/**/*.md'],
            specContext: ['**/specs/**/.spec-context.json', '**/docs/**/.spec-context.json'],
        });
    });

    it('watches a folder of specs from the folder itself, so deleting a spec folder is seen', () => {
        mockConfig(['apps/*/specs/']);

        expect(getFileWatcherPatterns().specs).toEqual(['**/apps/*/specs/**/*']);
    });
});

describe('hasDuplicateNames', () => {
    it('returns empty set when all names are unique', () => {
        const specs = [
            { name: 'auth', path: 'specs/auth' },
            { name: 'login', path: 'specs/login' },
        ];
        expect(hasDuplicateNames(specs).size).toBe(0);
    });

    it('returns names that appear more than once', () => {
        const specs = [
            { name: 'auth', path: 'specs/auth' },
            { name: 'auth', path: 'other/auth' },
            { name: 'login', path: 'specs/login' },
        ];
        const dupes = hasDuplicateNames(specs);
        expect(dupes).toEqual(new Set(['auth']));
    });
});

describe('per-workflow steering exclusion (issue #425)', () => {
    // Key-aware config: specDirectories vs customWorkflows return different values.
    function mockConfigWithSteering(specDirectories: string[], steeringPaths: string[]) {
        mockWorkspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
                if (key === 'specDirectories') return specDirectories;
                if (key === 'customWorkflows') return [{ name: 'gsd', steering: steeringPaths.map(p => ({ path: p })) }];
                return def;
            }),
        } as any);
    }

    it('drops a discovered spec folder that is declared as a steering source', async () => {
        mockConfigWithSteering(['specs'], ['specs/reference']);
        // reference/ is excluded before its content is read, so only auth/ is scanned.
        (mockWorkspace.fs.readDirectory as jest.Mock)
            .mockResolvedValueOnce([
                ['auth', vscode.FileType.Directory],
                ['reference', vscode.FileType.Directory],
            ])
            .mockResolvedValueOnce([['spec.md', vscode.FileType.File]]);  // auth/

        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toEqual([{ name: 'auth', path: 'specs/auth' }]);
    });

    it('isInsideSpecDirectory returns undefined for a file under a steering source', () => {
        mockConfigWithSteering(['specs'], ['specs/reference']);
        expect(isInsideSpecDirectory('/workspace/specs/reference/notes.md', WORKSPACE)).toBeUndefined();
        expect(isInsideSpecDirectory('/workspace/specs/auth/spec.md', WORKSPACE)).toBe('specs/auth');
    });

    it('no steering configured leaves discovery unchanged', async () => {
        mockConfigWithSteering(['specs'], []);
        (mockWorkspace.fs.readDirectory as jest.Mock)
            .mockResolvedValueOnce([['auth', vscode.FileType.Directory]])
            .mockResolvedValueOnce([['spec.md', vscode.FileType.File]]);
        const result = await resolveSpecDirectories(WORKSPACE);
        expect(result).toEqual([{ name: 'auth', path: 'specs/auth' }]);
    });
});

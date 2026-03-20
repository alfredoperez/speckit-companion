import * as vscode from 'vscode';
import {
    resolveSpecDirectories,
    isInsideSpecDirectory,
    getFileWatcherPatterns,
    hasDuplicateNames,
} from './specDirectoryResolver';

const mockWorkspace = vscode.workspace as jest.Mocked<typeof vscode.workspace>;

function mockConfig(specDirectories: string[]) {
    mockWorkspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockReturnValue(specDirectories),
    } as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockConfig(['specs']);
    (mockWorkspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);
    (mockWorkspace.findFiles as jest.Mock).mockResolvedValue([]);
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
    it('generates spec/task/markdown patterns for each configured directory', () => {
        mockConfig(['specs', 'docs']);

        const result = getFileWatcherPatterns();

        expect(result).toEqual({
            specs: ['**/specs/**/*', '**/docs/**/*'],
            tasks: ['**/specs/**/tasks.md', '**/docs/**/tasks.md'],
            markdown: ['**/specs/**/*.md', '**/docs/**/*.md'],
        });
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

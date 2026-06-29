import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    readCompanionConfigGroups,
    readCompanionCommands,
    companionCommandFilePath,
    isWithinRoot,
} from './companionSteering';

describe('companionSteering', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-steering-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const writeConfig = (body: string): void => {
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        fs.writeFileSync(path.join(root, '.specify', 'companion.yml'), body);
    };
    const writeManifest = (body: string): void => {
        const dir = path.join(root, '.specify', 'extensions', 'companion');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'extension.yml'), body);
    };

    describe('readCompanionConfigGroups', () => {
        it('returns the top-level setting groups of companion.yml', () => {
            writeConfig('commands:\n  implement: {}\nhooks:\n  after_specify: {}\n');
            expect(readCompanionConfigGroups(root)).toEqual(['commands', 'hooks']);
        });

        it('returns [] when the config file is absent', () => {
            expect(readCompanionConfigGroups(root)).toEqual([]);
        });

        it('returns [] when the config is malformed', () => {
            writeConfig(': not: valid: yaml:\n  - [unbalanced');
            expect(readCompanionConfigGroups(root)).toEqual([]);
        });

        it('returns [] when the config is a non-object (e.g. a list)', () => {
            writeConfig('- one\n- two\n');
            expect(readCompanionConfigGroups(root)).toEqual([]);
        });
    });

    describe('readCompanionCommands', () => {
        it('returns provides.commands as name/description/file triples', () => {
            writeManifest([
                'provides:',
                '  commands:',
                '    - name: speckit.companion.specify',
                '      description: Companion specify',
                '      file: commands/speckit.companion.specify.md',
                '    - name: speckit.companion.plan',
                '      description: Companion plan',
                '      file: commands/speckit.companion.plan.md',
            ].join('\n'));
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.specify', description: 'Companion specify', file: 'commands/speckit.companion.specify.md' },
                { name: 'speckit.companion.plan', description: 'Companion plan', file: 'commands/speckit.companion.plan.md' },
            ]);
        });

        it('defaults a missing description and file to empty strings', () => {
            writeManifest('provides:\n  commands:\n    - name: speckit.companion.status\n');
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.status', description: '', file: '' },
            ]);
        });

        it('skips entries without a string name', () => {
            writeManifest('provides:\n  commands:\n    - description: orphan\n    - name: speckit.companion.resume\n');
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.resume', description: '', file: '' },
            ]);
        });

        it('returns [] when the manifest is absent', () => {
            expect(readCompanionCommands(root)).toEqual([]);
        });

        it('returns [] when provides.commands is missing or not a list', () => {
            writeManifest('provides:\n  commands: not-a-list\n');
            expect(readCompanionCommands(root)).toEqual([]);
        });
    });

    describe('companionCommandFilePath', () => {
        const writeCommandFile = (rel: string): string => {
            const abs = path.join(root, '.specify', 'extensions', 'companion', rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, '# command');
            return abs;
        };

        it('resolves an existing command body under the extension dir', () => {
            const abs = writeCommandFile('commands/speckit.companion.capture.md');
            expect(companionCommandFilePath(root, 'commands/speckit.companion.capture.md')).toBe(abs);
        });

        it('returns undefined when the file does not exist on disk', () => {
            expect(companionCommandFilePath(root, 'commands/missing.md')).toBeUndefined();
        });

        it('returns undefined for an empty file field', () => {
            expect(companionCommandFilePath(root, '')).toBeUndefined();
        });

        it('returns undefined for a traversal that escapes the root', () => {
            expect(companionCommandFilePath(root, '../../../../etc/passwd')).toBeUndefined();
        });
    });

    describe('isWithinRoot', () => {
        it('accepts a path nested inside the root', () => {
            expect(isWithinRoot(root, path.join(root, '.specify/companion.yml'))).toBe(true);
        });

        it('rejects a path that escapes via ..', () => {
            expect(isWithinRoot(root, path.join(root, '../secret.md'))).toBe(false);
        });

        it('rejects an absolute path outside the root', () => {
            expect(isWithinRoot(root, '/etc/passwd')).toBe(false);
        });

        it('accepts an in-root name that merely starts with .. (not traversal)', () => {
            expect(isWithinRoot(root, path.join(root, '..config.yml'))).toBe(true);
        });

        it('accepts the root itself', () => {
            expect(isWithinRoot(root, root)).toBe(true);
        });
    });
});

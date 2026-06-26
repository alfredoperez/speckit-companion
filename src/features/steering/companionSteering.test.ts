import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    readCompanionConfigGroups,
    readCompanionCommands,
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
        it('returns provides.commands as name/description pairs', () => {
            writeManifest([
                'provides:',
                '  commands:',
                '    - name: speckit.companion.specify',
                '      description: Companion specify',
                '    - name: speckit.companion.plan',
                '      description: Companion plan',
            ].join('\n'));
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.specify', description: 'Companion specify' },
                { name: 'speckit.companion.plan', description: 'Companion plan' },
            ]);
        });

        it('defaults a missing description to an empty string', () => {
            writeManifest('provides:\n  commands:\n    - name: speckit.companion.status\n');
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.status', description: '' },
            ]);
        });

        it('skips entries without a string name', () => {
            writeManifest('provides:\n  commands:\n    - description: orphan\n    - name: speckit.companion.resume\n');
            expect(readCompanionCommands(root)).toEqual([
                { name: 'speckit.companion.resume', description: '' },
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
    });
});

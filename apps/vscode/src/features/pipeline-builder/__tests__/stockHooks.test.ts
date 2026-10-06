import { setHookEnabled } from '../stockHooks';

const REGISTRY = [
    'installed:',
    '- git',
    'settings:',
    '  auto_execute_hooks: true',
    'hooks:',
    '  before_specify:',
    '  - extension: git',
    '    command: speckit.git.feature',
    '    enabled: true',
    '    optional: false',
    '    description: Create feature branch before specification',
    '    condition: null',
    '  - extension: github',
    '    command: speckit.github.label',
    '    enabled: true',
    '  after_specify:',
    '  - extension: git',
    '    command: speckit.git.commit',
    '    enabled: true',
    '',
].join('\n');

function lines(text: string): string[] {
    return text.split('\n');
}

describe('switching one extension hook off', () => {
    it('changes that hook and nothing else in the file', () => {
        const result = setHookEnabled(REGISTRY, {
            step: 'specify', when: 'before', index: 0, enabled: false,
        });
        if ('error' in result) { throw new Error(result.error); }

        const before = lines(REGISTRY);
        const after = lines(result.text);
        const moved = after.filter((line, i) => line !== before[i]);

        expect(moved).toEqual(['    enabled: false']);
    });

    it('reaches the second hook under the same key', () => {
        const result = setHookEnabled(REGISTRY, {
            step: 'specify', when: 'before', index: 1, enabled: false,
        });
        if ('error' in result) { throw new Error(result.error); }

        expect(lines(result.text)[14]).toBe('    enabled: false');
        expect(lines(result.text)[8]).toBe('    enabled: true');
    });

    it('keeps the before and after keys apart', () => {
        const result = setHookEnabled(REGISTRY, {
            step: 'specify', when: 'after', index: 0, enabled: false,
        });
        if ('error' in result) { throw new Error(result.error); }

        expect(result.text).toContain('    command: speckit.git.commit\n    enabled: false');
        expect(result.text).toContain('    command: speckit.git.feature\n    enabled: true');
    });

    it('writes the switch in when the hook never had one', () => {
        const registry = [
            'hooks:',
            '  before_plan:',
            '  - extension: git',
            '    command: speckit.git.commit',
            '',
        ].join('\n');

        const result = setHookEnabled(registry, {
            step: 'plan', when: 'before', index: 0, enabled: false,
        });
        if ('error' in result) { throw new Error(result.error); }

        expect(result.text).toContain('  - extension: git\n    enabled: false');
    });

    it('refuses a step the registry does not have, leaving the text untouched', () => {
        const result = setHookEnabled(REGISTRY, {
            step: 'converge', when: 'before', index: 0, enabled: false,
        });

        expect(result).toEqual({ error: 'before_converge is not in this registry.' });
    });

    it('refuses an index past the hooks there are', () => {
        const result = setHookEnabled(REGISTRY, {
            step: 'specify', when: 'after', index: 3, enabled: false,
        });

        expect('error' in result && result.error).toContain('no hook 4 after specify');
    });
});

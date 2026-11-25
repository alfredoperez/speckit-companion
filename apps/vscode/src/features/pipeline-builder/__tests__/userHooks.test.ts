import * as yaml from 'js-yaml';
import { StockHookDraft } from '../../../protocol/pipeline';
import { addUserHook, removeUserHook, setHookEnabled, updateUserHook } from '../stockHooks';

const INSTALLED = new Set(['git']);

const REGISTRY = [
    '# Spec Kit hook registry',
    'installed:',
    '- git',
    'hooks:',
    '  before_plan:',
    '  - extension: git',
    '    command: speckit.git.commit',
    '    enabled: true',
    '    optional: true  # ask first',
    '    description: Auto-commit before planning',
    '    condition: null',
    '  after_plan:',
    '  - extension: git',
    '    command: speckit.git.commit',
    '    enabled: true',
    '    optional: true',
    '    description: Commit plan changes',
    '',
    '  # my own',
    '  after_tasks:',
    '  - extension: house',
    '    command: house-note',
    '    enabled: true',
    '    optional: false',
    '    priority: 5',
    '    description: Log a house note',
    '  - extension: house',
    '    command: house-check',
    '    enabled: false',
    '    description: >',
    '      Check the house',
    '      rules',
    '',
].join('\n');

const NOTE: StockHookDraft = {
    command: 'house-note', description: 'Log a house note after plan', optional: false,
};

function ok(result: { text: string } | { error: string }): string {
    if ('error' in result) { throw new Error(result.error); }
    return result.text;
}

function hooks(text: string): Record<string, Array<Record<string, unknown>>> {
    return (yaml.load(text) as { hooks: Record<string, Array<Record<string, unknown>>> }).hooks;
}

/** The lines of `after` that are not in `before`, keeping order. */
function added(before: string, after: string): string[] {
    const old = before.split('\n');
    const now = after.split('\n');
    let i = 0;
    const extra: string[] = [];
    for (const line of now) {
        if (i < old.length && line === old[i]) { i += 1; } else { extra.push(line); }
    }
    expect(i).toBe(old.length);
    return extra;
}

describe('attaching your own hook to a stock step', () => {
    it('adds one entry and keeps every other line byte for byte', () => {
        const text = ok(addUserHook(REGISTRY, 'plan', 'after', NOTE, INSTALLED));
        expect(added(REGISTRY, text)).toEqual([
            '  - extension: project',
            '    command: house-note',
            '    enabled: true',
            '    optional: false',
            '    description: Log a house note after plan',
        ]);
        const entry = hooks(text).after_plan[1];
        expect(entry).toMatchObject({ extension: 'project', command: 'house-note', optional: false });
    });

    it('creates the registry when the project has none', () => {
        const text = ok(addUserHook(null, 'plan', 'after', { ...NOTE, prompt: 'Log it?' }, INSTALLED));
        expect(hooks(text).after_plan).toEqual([{
            extension: 'project', command: 'house-note', enabled: true, optional: false,
            prompt: 'Log it?', description: 'Log a house note after plan',
        }]);
    });

    it('adds a step key the registry did not have yet', () => {
        const text = ok(addUserHook(REGISTRY, 'specify', 'before', NOTE, INSTALLED));
        expect(added(REGISTRY, text)[0]).toBe('  before_specify:');
        expect(hooks(text).before_specify).toHaveLength(1);
    });

    it('adds a hooks section to a registry without one', () => {
        const start = 'installed:\n- git\n';
        const text = ok(addUserHook(start, 'plan', 'after', NOTE, INSTALLED));
        expect(text.startsWith(start)).toBe(true);
        expect(hooks(text).after_plan[0].command).toBe('house-note');
    });

    it('reads back a description and prompt with quotes, colons and a hash exactly', () => {
        const draft = { ...NOTE, description: 'Note: "house" #1', prompt: "Run it? it's: fine" };
        const text = ok(addUserHook(REGISTRY, 'plan', 'after', draft, INSTALLED));
        expect(hooks(text).after_plan[1]).toMatchObject({
            description: 'Note: "house" #1', prompt: "Run it? it's: fine",
        });
    });

    it('refuses a registry that is not valid YAML and returns nothing to write', () => {
        const broken = 'hooks:\n  after_plan: [unclosed\n';
        const result = addUserHook(broken, 'plan', 'after', NOTE, INSTALLED);
        expect(result).toEqual({ error: expect.stringContaining('could not be read') });
    });

    it('refuses a step key written in flow style', () => {
        const flow = 'hooks:\n  after_plan: []\n';
        expect(addUserHook(flow, 'plan', 'after', NOTE, INSTALLED))
            .toEqual({ error: expect.stringContaining('cannot edit safely') });
        expect(addUserHook('hooks: {}\n', 'plan', 'after', NOTE, INSTALLED))
            .toEqual({ error: expect.stringContaining('cannot edit safely') });
    });

    it('refuses an empty skill name, a name with spaces and an empty description', () => {
        expect('error' in addUserHook(REGISTRY, 'plan', 'after', { ...NOTE, command: ' ' }, INSTALLED)).toBe(true);
        expect('error' in addUserHook(REGISTRY, 'plan', 'after', { ...NOTE, command: 'rm -rf' }, INSTALLED)).toBe(true);
        expect('error' in addUserHook(REGISTRY, 'plan', 'after', { ...NOTE, description: '' }, INSTALLED)).toBe(true);
    });

    it('refuses a when other than before or after, and a draft missing its fields', () => {
        expect(addUserHook(REGISTRY, 'plan', 'during' as never, NOTE, INSTALLED))
            .toEqual({ error: expect.stringContaining('not a place a hook can attach') });
        expect(addUserHook(REGISTRY, 'plan', 'after', { command: 'x' } as never, INSTALLED))
            .toEqual({ error: expect.stringContaining('missing') });
    });

    it('refuses when an installed extension owns the id written on your hooks', () => {
        const result = addUserHook(REGISTRY, 'plan', 'after', NOTE, new Set(['git', 'project']));
        expect(result).toEqual({ error: expect.stringContaining('named project') });
    });
});

describe('changing a hook you added', () => {
    it('changes only that entry, keeping its priority', () => {
        const text = ok(updateUserHook(REGISTRY, { step: 'tasks', when: 'after', index: 0 },
            { command: 'house-log', description: 'Log a house note', optional: true, prompt: 'Log?' },
            INSTALLED));
        const before = REGISTRY.split('\n');
        const after = text.split('\n');
        expect(after.slice(0, 21)).toEqual(before.slice(0, 21));
        expect(hooks(text).after_tasks[0]).toEqual({
            extension: 'house', command: 'house-log', enabled: true, optional: true,
            priority: 5, description: 'Log a house note', prompt: 'Log?',
        });
        expect(hooks(text).after_tasks[1]).toEqual(hooks(REGISTRY).after_tasks[1]);
    });

    it('replaces a folded description and adds an optional line that was missing', () => {
        const text = ok(updateUserHook(REGISTRY, { step: 'tasks', when: 'after', index: 1 },
            { command: 'house-check', description: 'Check the rules', optional: true }, INSTALLED));
        expect(text).not.toContain('Check the house');
        expect(hooks(text).after_tasks[1]).toMatchObject({
            command: 'house-check', description: 'Check the rules', optional: true, enabled: false,
        });
    });

    it('rewrites only the field that changed, keeping comments and a folded description', () => {
        const mine = REGISTRY.replace('    command: house-check', '    command: house-check # my comment');
        const at = { step: 'tasks', when: 'after' as const, index: 1 };
        const same = { command: 'house-check', description: 'Check the house rules', optional: false };
        expect(ok(updateUserHook(mine, at, same, INSTALLED))).toBe(mine);

        const text = ok(updateUserHook(mine, at, { ...same, prompt: 'Check?' }, INSTALLED));
        expect(added(mine, text)).toEqual(['    prompt: Check?']);
        expect(text.split('\n').filter(line => !line.includes('prompt:'))).toEqual(mine.split('\n'));
    });

    it('keeps a trailing comment on a line whose value changed', () => {
        const mine = REGISTRY.replace('    command: house-note', '    command: house-note  # mine');
        const text = ok(updateUserHook(mine, { step: 'tasks', when: 'after', index: 0 },
            { ...NOTE, command: 'house-log', description: 'Log a house note' }, INSTALLED));
        expect(text).toBe(mine.replace('command: house-note  # mine', 'command: house-log  # mine'));
    });

    it('drops the prompt line when the prompt is cleared', () => {
        const withPrompt = ok(addUserHook(REGISTRY, 'plan', 'after', { ...NOTE, prompt: 'Log?' }, INSTALLED));
        const text = ok(updateUserHook(withPrompt, { step: 'plan', when: 'after', index: 1 }, NOTE, INSTALLED));
        expect(text).toBe(ok(addUserHook(REGISTRY, 'plan', 'after', NOTE, INSTALLED)));
    });

    it('refuses an installed extension\'s hook', () => {
        const result = updateUserHook(REGISTRY, { step: 'plan', when: 'after', index: 0 }, NOTE, INSTALLED);
        expect(result).toEqual({ error: expect.stringContaining('belongs to the git extension') });
    });

    it('refuses a hook that is not there', () => {
        const result = updateUserHook(REGISTRY, { step: 'plan', when: 'after', index: 4 }, NOTE, INSTALLED);
        expect(result).toEqual({ error: expect.stringContaining('no hook 5') });
    });
});

describe('removing a hook you added', () => {
    it('removes its lines and nothing else', () => {
        const text = ok(removeUserHook(REGISTRY, { step: 'tasks', when: 'after', index: 0 }, INSTALLED));
        const expected = REGISTRY.split('\n');
        expect(expected.splice(20, 6)[1]).toBe('    command: house-note');
        expect(text).toBe(expected.join('\n'));
    });

    it('removes the step key with its last entry', () => {
        const once = ok(addUserHook(REGISTRY, 'specify', 'before', NOTE, INSTALLED));
        expect(ok(removeUserHook(once, { step: 'specify', when: 'before', index: 0 }, INSTALLED)))
            .toBe(REGISTRY);
    });

    it('takes back exactly what adding wrote', () => {
        const once = ok(addUserHook(REGISTRY, 'plan', 'after', NOTE, INSTALLED));
        expect(ok(removeUserHook(once, { step: 'plan', when: 'after', index: 1 }, INSTALLED)))
            .toBe(REGISTRY);
    });

    it('refuses an installed extension\'s hook', () => {
        const result = removeUserHook(REGISTRY, { step: 'before', when: 'before', index: 0 }, INSTALLED);
        expect('error' in result).toBe(true);
        expect(removeUserHook(REGISTRY, { step: 'plan', when: 'before', index: 0 }, INSTALLED))
            .toEqual({ error: expect.stringContaining('belongs to the git extension') });
    });

    it('refuses malformed YAML', () => {
        const result = removeUserHook('hooks: [\n', { step: 'plan', when: 'after', index: 0 }, INSTALLED);
        expect(result).toEqual({ error: expect.stringContaining('could not be read') });
    });
});

describe('a registry with Windows line endings', () => {
    const CRLF = REGISTRY.split('\n').join('\r\n');
    const bare = (text: string) => text.replace(/\r\n/g, '');

    it('keeps every line CRLF through add, update, remove and a switch', () => {
        const once = ok(addUserHook(CRLF, 'plan', 'after', NOTE, INSTALLED));
        expect(bare(once)).not.toContain('\n');
        expect(once).toBe(ok(addUserHook(REGISTRY, 'plan', 'after', NOTE, INSTALLED)).split('\n').join('\r\n'));

        const changed = ok(updateUserHook(once, { step: 'plan', when: 'after', index: 1 },
            { ...NOTE, prompt: 'Log?', description: 'Changed' }, INSTALLED));
        expect(bare(changed)).not.toContain('\n');
        expect(hooks(changed).after_plan[1]).toMatchObject({ prompt: 'Log?', description: 'Changed' });

        expect(ok(removeUserHook(once, { step: 'plan', when: 'after', index: 1 }, INSTALLED))).toBe(CRLF);

        const off = ok(setHookEnabled(CRLF, { step: 'plan', when: 'before', index: 0, enabled: false }));
        expect(off).toBe(CRLF.replace('    enabled: true\r\n    optional: true  # ask', '    enabled: false\r\n    optional: true  # ask'));
    });
});

describe('a new key matches the list indent the file already uses', () => {
    const INDENTED = [
        'hooks:',
        '  before_plan:',
        '    - extension: git',
        '      command: speckit.git.commit',
        '      enabled: true',
        '      optional: false',
        '      description: Commit before planning',
        '',
    ].join('\n');

    it('indents the entry under a new key the way the file indents its others', () => {
        const out = ok(addUserHook(INDENTED, 'tasks', 'after', NOTE, INSTALLED));
        expect(out).toContain('  after_tasks:\n    - extension: ');
        expect(out).toContain('\n      command: house-note');
        expect(hooks(out).after_tasks).toHaveLength(1);
    });

    it('keeps spec-kit\'s own style, with the list level with its key', () => {
        const out = ok(addUserHook(REGISTRY, 'specify', 'before', NOTE, INSTALLED));
        expect(out).toContain('  before_specify:\n  - extension: ');
    });
});

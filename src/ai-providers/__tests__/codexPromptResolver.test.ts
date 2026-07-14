import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSlashCommand, resolveCodexPrompt } from '../codexPromptResolver';
import { MARKER_OPEN, MARKER_CLOSE } from '../promptPreamble';

const PREAMBLE = `${MARKER_OPEN}\nRecord the step in .spec-context.json.\n${MARKER_CLOSE}`;

/** Every command the companion spec-kit extension provides — the full surface Codex can be asked to dispatch. */
function companionCommands(): string[] {
    const manifest = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'speckit-extension', 'extension.yml'),
        'utf8',
    );
    return [...manifest.matchAll(/^\s*-\s+name:\s+(speckit\.companion\.[\w.-]+)\s*$/gm)].map(m => m[1]);
}

describe('codexPromptResolver', () => {
    let workspaceRoot: string;

    const writeSkill = (skillName: string, body: string) => {
        const dir = path.join(workspaceRoot, '.agents', 'skills', skillName);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
    };

    const writeLegacyPrompt = (fileStem: string, body: string) => {
        const dir = path.join(workspaceRoot, '.codex', 'prompts');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${fileStem}.md`), body, 'utf8');
    };

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-resolver-'));
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    describe('parsing a slash command', () => {
        it('keeps every segment of a namespaced companion command', () => {
            expect(parseSlashCommand('/speckit.companion.specify add auth')).toEqual({
                skillName: 'speckit-companion-specify',
                args: 'add auth',
            });
        });

        it('keeps the hyphen inside a command leaf', () => {
            expect(parseSlashCommand('/speckit.companion.mark-complete')).toEqual({
                skillName: 'speckit-companion-mark-complete',
                args: '',
            });
            expect(parseSlashCommand('/speckit.companion.capture-implement specs/012-x')).toEqual({
                skillName: 'speckit-companion-capture-implement',
                args: 'specs/012-x',
            });
        });

        it('parses the dashed spelling the extension dispatches to Codex', () => {
            expect(parseSlashCommand('/speckit-companion-mark-complete')).toEqual({
                skillName: 'speckit-companion-mark-complete',
                args: '',
            });
        });

        it('parses a stock command with no arguments', () => {
            expect(parseSlashCommand('/speckit.plan')).toEqual({ skillName: 'speckit-plan', args: '' });
        });

        it('tolerates surrounding whitespace', () => {
            expect(parseSlashCommand('  /speckit.plan specs/012-x  ')).toEqual({
                skillName: 'speckit-plan',
                args: 'specs/012-x',
            });
        });

        it('keeps trailing lines of a multi-line argument', () => {
            expect(parseSlashCommand('/speckit.plan specs/012-x\n\nAlso drop the cache layer.')?.args).toBe(
                'specs/012-x\n\nAlso drop the cache layer.',
            );
        });

        it('returns null for anything that is not a SpecKit slash command', () => {
            expect(parseSlashCommand('refactor the auth module')).toBeNull();
            expect(parseSlashCommand('/other.command')).toBeNull();
            expect(parseSlashCommand('/')).toBeNull();
            expect(parseSlashCommand('/speckit')).toBeNull();
            expect(parseSlashCommand('/speckit.')).toBeNull();
        });
    });

    describe('resolving against the skills spec-kit emits for Codex', () => {
        it('substitutes the arguments into the skill body', () => {
            writeSkill('speckit-companion-specify', 'Write a spec for: $ARGUMENTS');

            const result = resolveCodexPrompt(workspaceRoot, '/speckit.companion.specify add auth', 'FALLBACK');

            expect(result.text).toBe('Write a spec for: add auth');
            expect(result.promptFilePath).toBe(
                path.join(workspaceRoot, '.agents', 'skills', 'speckit-companion-specify', 'SKILL.md'),
            );
        });

        it('resolves every command the companion extension provides, in both spellings', () => {
            const commands = companionCommands();
            expect(commands).toHaveLength(16);

            commands.forEach(commandId => {
                const skillName = `speckit-${commandId.slice('speckit.'.length).replace(/\./g, '-')}`;
                writeSkill(skillName, `body:${commandId}`);
            });

            commands.forEach(commandId => {
                for (const invocation of [`/${commandId}`, `/${commandId.replace(/\./g, '-')}`]) {
                    const result = resolveCodexPrompt(workspaceRoot, invocation, 'FALLBACK');
                    expect(result.promptFilePath).not.toBeNull();
                    expect(result.text).toBe(`body:${commandId}`);
                }
            });
        });
    });

    describe('resolving a prompt that carries the context preamble', () => {
        it('substitutes the command and keeps the preamble leading', () => {
            writeSkill('speckit-companion-plan', 'Plan: $ARGUMENTS');

            const result = resolveCodexPrompt(
                workspaceRoot,
                `${PREAMBLE}\n\n/speckit-companion-plan specs/012-x`,
                'FALLBACK',
            );

            expect(result.text).toBe(`${PREAMBLE}\n\nPlan: specs/012-x`);
        });

        it('carries refinement text appended below the command into the arguments', () => {
            writeSkill('speckit-companion-plan', 'Plan: $ARGUMENTS');

            const result = resolveCodexPrompt(
                workspaceRoot,
                `${PREAMBLE}\n\n/speckit-companion-plan specs/012-x\n\nUse Postgres, not SQLite.`,
                'FALLBACK',
            );

            expect(result.text).toBe(`${PREAMBLE}\n\nPlan: specs/012-x\n\nUse Postgres, not SQLite.`);
        });
    });

    describe('resolving against a legacy prompts workspace', () => {
        it('falls back to the deprecated .codex/prompts layout', () => {
            writeLegacyPrompt('speckit.specify', 'Legacy: $ARGUMENTS');

            const result = resolveCodexPrompt(workspaceRoot, '/speckit.specify add auth', 'FALLBACK');

            expect(result.text).toBe('Legacy: add auth');
            expect(result.promptFilePath).toBe(path.join(workspaceRoot, '.codex', 'prompts', 'speckit.specify.md'));
        });

        it('finds a prompt file whose command leaf is hyphenated', () => {
            writeLegacyPrompt('speckit.companion.mark-complete', 'Legacy mark-complete');

            expect(resolveCodexPrompt(workspaceRoot, '/speckit.companion.mark-complete', 'FALLBACK').text).toBe(
                'Legacy mark-complete',
            );
            expect(resolveCodexPrompt(workspaceRoot, '/speckit-companion-mark-complete', 'FALLBACK').text).toBe(
                'Legacy mark-complete',
            );
        });

        it('prefers the skill emission when both layouts are present', () => {
            writeSkill('speckit-specify', 'From skill');
            writeLegacyPrompt('speckit.specify', 'From legacy prompt');

            expect(resolveCodexPrompt(workspaceRoot, '/speckit.specify', 'FALLBACK').text).toBe('From skill');
        });
    });

    describe('when no template exists', () => {
        it('returns the caller fallback with no resolved path', () => {
            const result = resolveCodexPrompt(workspaceRoot, '/speckit.companion.plan', 'FALLBACK');

            expect(result.text).toBe('FALLBACK');
            expect(result.promptFilePath).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it('returns the fallback when there is no workspace', () => {
            expect(resolveCodexPrompt(undefined, '/speckit.companion.plan', 'FALLBACK').text).toBe('FALLBACK');
        });

        it('returns the fallback for a prompt that is not a slash command', () => {
            expect(resolveCodexPrompt(workspaceRoot, 'refactor the auth module', 'FALLBACK').text).toBe('FALLBACK');
        });
    });
});

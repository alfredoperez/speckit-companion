import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSlashCommand, resolveCodexPrompt } from '../codexPromptResolver';

describe('codexPromptResolver', () => {
    let workspaceRoot: string;

    const writeSkill = (skillName: string, body: string) => {
        const dir = path.join(workspaceRoot, '.agents', 'skills', skillName);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), body, 'utf8');
    };

    const writeLegacyPrompt = (commandId: string, body: string) => {
        const dir = path.join(workspaceRoot, '.codex', 'prompts');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${commandId}.md`), body, 'utf8');
    };

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-resolver-'));
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    describe('parsing a slash command', () => {
        it('keeps the full dotted id of a namespaced companion command', () => {
            expect(parseSlashCommand('/speckit.companion.specify add auth')).toEqual({
                commandId: 'speckit.companion.specify',
                skillName: 'speckit-companion-specify',
                args: 'add auth',
            });
        });

        it('parses a stock command with no arguments', () => {
            expect(parseSlashCommand('/speckit.plan')).toEqual({
                commandId: 'speckit.plan',
                skillName: 'speckit-plan',
                args: '',
            });
        });

        it('accepts the dashed skill spelling of a namespaced command', () => {
            expect(parseSlashCommand('/speckit-companion-mark-complete')).toEqual({
                commandId: 'speckit.companion.mark.complete',
                skillName: 'speckit-companion-mark-complete',
                args: '',
            });
        });

        it('returns null for prompts that are not SpecKit slash commands', () => {
            expect(parseSlashCommand('refactor the auth module')).toBeNull();
            expect(parseSlashCommand('/other.command')).toBeNull();
        });
    });

    describe('resolving a companion command against a spec-kit workspace', () => {
        it('resolves the skill spec-kit emits for Codex, with arguments substituted', () => {
            writeSkill('speckit-companion-specify', 'Write a spec for: $ARGUMENTS');

            const result = resolveCodexPrompt(workspaceRoot, '/speckit.companion.specify add auth', 'FALLBACK');

            expect(result.text).toBe('Write a spec for: add auth');
            expect(result.promptFilePath).toBe(
                path.join(workspaceRoot, '.agents', 'skills', 'speckit-companion-specify', 'SKILL.md'),
            );
        });

        it('resolves every companion pipeline command rather than silently falling back', () => {
            const commands = [
                'speckit.companion.specify',
                'speckit.companion.plan',
                'speckit.companion.tasks',
                'speckit.companion.implement',
                'speckit.companion.resume',
                'speckit.companion.status',
                'speckit.companion.mark-complete',
            ];
            commands.forEach(commandId => {
                writeSkill(`speckit-${commandId.slice('speckit.'.length).replace(/\./g, '-')}`, `body:${commandId}`);
            });

            commands.forEach(commandId => {
                const result = resolveCodexPrompt(workspaceRoot, `/${commandId}`, 'FALLBACK');
                expect(result.promptFilePath).not.toBeNull();
                expect(result.text).toBe(`body:${commandId}`);
            });
        });
    });

    describe('resolving against a legacy prompts workspace', () => {
        it('falls back to the deprecated .codex/prompts layout', () => {
            writeLegacyPrompt('speckit.specify', 'Legacy: $ARGUMENTS');

            const result = resolveCodexPrompt(workspaceRoot, '/speckit.specify add auth', 'FALLBACK');

            expect(result.text).toBe('Legacy: add auth');
            expect(result.promptFilePath).toBe(
                path.join(workspaceRoot, '.codex', 'prompts', 'speckit.specify.md'),
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
        });

        it('returns the fallback when there is no workspace', () => {
            expect(resolveCodexPrompt(undefined, '/speckit.companion.plan', 'FALLBACK').text).toBe('FALLBACK');
        });
    });
});

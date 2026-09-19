import { buildPromptDispatchCommand } from '../aiProvider';

describe('buildPromptDispatchCommand', () => {
    it('produces $(cat …) substitution for bash shell', () => {
        const line = buildPromptDispatchCommand({
            cliInvocation: 'copilot',
            flags: '--yolo -p ',
            promptFilePath: '/tmp/p.md',
            promptText: 'unused',
            shell: 'bash',
        });

        expect(line).toBe('copilot --yolo -p "$(cat "/tmp/p.md")"');
    });

    it('produces Get-Content substitution for powershell shell', () => {
        const line = buildPromptDispatchCommand({
            cliInvocation: 'copilot',
            flags: '--yolo -p ',
            promptFilePath: '/tmp/p.md',
            promptText: 'unused',
            shell: 'powershell',
        });

        expect(line).toBe(`copilot --yolo -p "$(Get-Content -Raw '/tmp/p.md')"`);
    });

    it('falls back to bash form for unknown shell', () => {
        const line = buildPromptDispatchCommand({
            cliInvocation: 'copilot',
            flags: '--yolo -p ',
            promptFilePath: '/tmp/p.md',
            promptText: 'unused',
            shell: 'unknown',
        });

        expect(line).toBe('copilot --yolo -p "$(cat "/tmp/p.md")"');
    });

    describe('cmd shell', () => {
        it('embeds prompt directly with internal quotes doubled', () => {
            const line = buildPromptDispatchCommand({
                cliInvocation: 'copilot',
                flags: '--yolo -p ',
                promptFilePath: 'C:\\tmp\\p.md',
                promptText: 'hello "world"',
                shell: 'cmd',
            });

            expect(line).toContain('"hello ""world"""');
            expect(line).not.toContain('cat');
        });

        it('embeds plain prompt text directly without substitution', () => {
            const line = buildPromptDispatchCommand({
                cliInvocation: 'copilot',
                flags: '--yolo -p ',
                promptFilePath: 'C:\\tmp\\p.md',
                promptText: 'plain text',
                shell: 'cmd',
            });

            expect(line).toBe('copilot --yolo -p "plain text"');
        });

        it('throws when embedded prompt exceeds the cmd.exe line limit', () => {
            const longPrompt = 'a'.repeat(8100);

            expect(() =>
                buildPromptDispatchCommand({
                    cliInvocation: 'copilot',
                    flags: '--yolo -p ',
                    promptFilePath: 'C:\\tmp\\p.md',
                    promptText: longPrompt,
                    shell: 'cmd',
                })
            ).toThrow(/cmd\.exe.*8000/);
        });
    });
});

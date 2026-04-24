import { buildCodexExecCommand } from '../codexCommandBuilder';

describe('buildCodexExecCommand', () => {
    describe('when script is "sh"', () => {
        it('should emit a cat-piped command using the given prompt file path', () => {
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: '/tmp/prompt.md',
            });
            expect(cmd).toBe('cat "/tmp/prompt.md" | codex exec -');
        });

        it('should not contain any stray "<" redirection character', () => {
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: '/tmp/prompt.md',
            });
            expect(cmd).not.toMatch(/(^|\s)</);
        });
    });

    describe('when script is "ps"', () => {
        it('should emit a Get-Content piped command using the given prompt file path', () => {
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: '/tmp/prompt.md',
            });
            expect(cmd).toBe('$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "/tmp/prompt.md" -Raw -Encoding UTF8 | codex exec -');
        });

        it('should not contain any stray "<" redirection character', () => {
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: '/tmp/prompt.md',
            });
            expect(cmd).not.toMatch(/(^|\s)</);
        });
    });

    describe('permissionFlag handling', () => {
        const flag = '--dangerously-bypass-approvals-and-sandbox';

        it('should insert the flag right before the trailing "-" for sh', () => {
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: flag,
            });
            expect(cmd).toBe(`cat "/tmp/prompt.md" | codex exec ${flag} -`);
        });

        it('should insert the flag right before the trailing "-" for ps', () => {
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: flag,
            });
            expect(cmd).toBe(`$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "/tmp/prompt.md" -Raw -Encoding UTF8 | codex exec ${flag} -`);
        });

        it('should treat an empty permissionFlag as absent (sh)', () => {
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: '',
            });
            expect(cmd).toBe('cat "/tmp/prompt.md" | codex exec -');
        });

        it('should treat a whitespace-only permissionFlag as absent (sh)', () => {
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: '   ',
            });
            expect(cmd).toBe('cat "/tmp/prompt.md" | codex exec -');
        });

        it('should treat an empty permissionFlag as absent (ps)', () => {
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: '',
            });
            expect(cmd).toBe('$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "/tmp/prompt.md" -Raw -Encoding UTF8 | codex exec -');
        });

        it('should treat a whitespace-only permissionFlag as absent (ps)', () => {
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: '/tmp/prompt.md',
                permissionFlag: '\t  \n',
            });
            expect(cmd).toBe('$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "/tmp/prompt.md" -Raw -Encoding UTF8 | codex exec -');
        });
    });

    describe('prompt file path handling', () => {
        it('should embed a path with spaces verbatim inside double quotes for sh', () => {
            const path = '/tmp/my folder/prompt.md';
            const cmd = buildCodexExecCommand({
                script: 'sh',
                promptFilePath: path,
            });
            expect(cmd).toBe('cat "/tmp/my folder/prompt.md" | codex exec -');
            expect(cmd).toContain(`"${path}"`);
        });

        it('should embed a path with spaces verbatim inside double quotes for ps', () => {
            const path = '/tmp/my folder/prompt.md';
            const cmd = buildCodexExecCommand({
                script: 'ps',
                promptFilePath: path,
            });
            expect(cmd).toBe('$OutputEncoding = [System.Text.UTF8Encoding]::new(); Get-Content "/tmp/my folder/prompt.md" -Raw -Encoding UTF8 | codex exec -');
            expect(cmd).toContain(`"${path}"`);
        });
    });
});

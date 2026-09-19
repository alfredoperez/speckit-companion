import * as vscode from 'vscode';
import { detectShell, formatPromptFileSubstitution } from '../shellDetection';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setPlatform(value: string) {
    Object.defineProperty(process, 'platform', { value, configurable: true });
}

function setShell(value: string) {
    (vscode.env as { shell: string }).shell = value;
}

afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    setShell('');
});

describe('detectShell', () => {
    it('detects pwsh.exe (Windows PowerShell 7) as powershell', () => {
        // Use forward slashes — path.basename in this Node process is bound to the
        // host platform (POSIX in CI/dev), so backslash-only paths return the whole
        // string. The shell-detection logic only cares about the trailing executable.
        setShell('C:/Program Files/PowerShell/7/pwsh.exe');
        expect(detectShell()).toBe('powershell');
    });

    it('detects powershell.exe (Windows PowerShell 5.1) as powershell', () => {
        setShell('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
        expect(detectShell()).toBe('powershell');
    });

    it('detects /bin/bash as bash', () => {
        setShell('/bin/bash');
        expect(detectShell()).toBe('bash');
    });

    it('detects /bin/zsh as bash', () => {
        setShell('/bin/zsh');
        expect(detectShell()).toBe('bash');
    });

    it('detects /usr/local/bin/sh as bash', () => {
        setShell('/usr/local/bin/sh');
        expect(detectShell()).toBe('bash');
    });

    it('detects cmd.exe as cmd', () => {
        setShell('C:/Windows/System32/cmd.exe');
        expect(detectShell()).toBe('cmd');
    });

    it('falls back to powershell when shell is empty on win32', () => {
        setShell('');
        setPlatform('win32');
        expect(detectShell()).toBe('powershell');
    });

    it('falls back to bash when shell is empty on darwin', () => {
        setShell('');
        setPlatform('darwin');
        expect(detectShell()).toBe('bash');
    });

    it('falls back to bash when shell is empty on linux', () => {
        setShell('');
        setPlatform('linux');
        expect(detectShell()).toBe('bash');
    });

    it('returns unknown for an unrecognized shell path', () => {
        setShell('/opt/fish');
        expect(detectShell()).toBe('unknown');
    });
});

describe('formatPromptFileSubstitution', () => {
    it('produces $(cat "...") for bash', () => {
        expect(formatPromptFileSubstitution('bash', '/tmp/p.md')).toBe('$(cat "/tmp/p.md")');
    });

    it('produces single-quoted Get-Content -Raw for powershell', () => {
        expect(formatPromptFileSubstitution('powershell', 'C:\\Users\\a\\p.md'))
            .toBe("$(Get-Content -Raw 'C:\\Users\\a\\p.md')");
    });

    it('returns empty string for cmd', () => {
        expect(formatPromptFileSubstitution('cmd', '/anything')).toBe('');
    });

    it('falls back to bash form for unknown', () => {
        expect(formatPromptFileSubstitution('unknown', '/tmp/p.md')).toBe('$(cat "/tmp/p.md")');
    });
});

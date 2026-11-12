import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateRoot } from './workspace.mjs';

const exec = promisify(execFile);

export async function pickerStartDirectory(root, run = exec) {
    try {
        const { stdout } = await run('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z'], { timeout: 5000 });
        const main = stdout.split('\0').find(line => line.startsWith('worktree '))?.slice(9);
        return main ? validateRoot(main) : root;
    } catch {
        return root;
    }
}

export async function pickFolder(root, { platform = process.platform, run = exec } = {}) {
    const start = await pickerStartDirectory(root, run);
    if (platform === 'win32') {
        const script = [
            '$ErrorActionPreference = "Stop"',
            '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()',
            'Add-Type -AssemblyName System.Windows.Forms',
            '$dialog = [System.Windows.Forms.FolderBrowserDialog]::new()',
            '$dialog.Description = "Choose a repository directory"',
            '$dialog.SelectedPath = $env:SPECKIT_PICKER_START',
            'try { if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) } } finally { $dialog.Dispose() }',
        ].join('; ');
        const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], {
            env: { ...process.env, SPECKIT_PICKER_START: start },
            windowsHide: true,
        });
        return stdout || null;
    }
    if (platform === 'darwin') {
        const script = 'on run argv\ntry\nreturn POSIX path of (choose folder with prompt "Choose a repository directory" default location (POSIX file (item 1 of argv)))\non error messageText number errorNumber\nif errorNumber is -128 then return ""\nerror messageText number errorNumber\nend try\nend run';
        const { stdout } = await run('osascript', ['-e', script, start]);
        return stdout.replace(/\r?\n$/, '') || null;
    }
    if (platform === 'linux') {
        try {
            const { stdout } = await run('zenity', ['--file-selection', '--directory', '--title=Choose a repository directory', `--filename=${start.replace(/\/?$/, '/')}`]);
            return stdout.replace(/\r?\n$/, '') || null;
        } catch (error) {
            if (error.code === 1 && !error.signal && !error.stderr?.trim()) return null;
            throw error;
        }
    }
    throw new Error('A native folder picker is unavailable on this host. Enter the directory manually.');
}

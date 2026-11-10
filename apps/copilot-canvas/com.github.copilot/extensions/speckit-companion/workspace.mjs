import { mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

export function validateRoot(root) {
    if (typeof root !== 'string' || !root.trim() || !isAbsolute(root)) {
        throw new Error('Choose an absolute repository directory path.');
    }
    const resolved = realpathSync(root);
    if (!statSync(resolved).isDirectory()) throw new Error('The repository path must be a directory.');
    return resolved;
}

export function rootSelection(workspacePath) {
    const file = workspacePath && join(workspacePath, 'files', 'speckit-companion', 'board.json');
    return {
        read() {
            if (!file) return null;
            let text;
            try {
                text = readFileSync(file, 'utf8');
            } catch (error) {
                if (error.code === 'ENOENT') return null;
                throw error;
            }
            return validateRoot(JSON.parse(text).root);
        },
        write(root) {
            if (!file) throw new Error('Session storage is unavailable; the repository selection cannot be saved.');
            mkdirSync(dirname(file), { recursive: true });
            const temporary = `${file}.tmp`;
            writeFileSync(temporary, `${JSON.stringify({ root })}\n`, { mode: 0o600 });
            renameSync(temporary, file);
        },
    };
}

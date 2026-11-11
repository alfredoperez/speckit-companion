import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
        clear() {
            if (!file) return;
            rmSync(file, { force: true });
        },
        source() {
            if (!file) return null;
            try {
                const { source } = JSON.parse(readFileSync(file, 'utf8'));
                return source && typeof source.sessionId === 'string' ? { sessionId: source.sessionId, name: String(source.name ?? source.sessionId) } : null;
            } catch {
                return null;
            }
        },
        write(root, source) {
            if (!file) throw new Error('Session storage is unavailable; the repository selection cannot be saved.');
            mkdirSync(dirname(file), { recursive: true });
            const temporary = `${file}.tmp`;
            writeFileSync(temporary, `${JSON.stringify(source ? { root, source } : { root })}\n`, { mode: 0o600 });
            renameSync(temporary, file);
        },
    };
}

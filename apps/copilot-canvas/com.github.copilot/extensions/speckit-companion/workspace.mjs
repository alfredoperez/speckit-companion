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
    function load() {
        if (!file) return {};
        try {
            return JSON.parse(readFileSync(file, 'utf8'));
        } catch (error) {
            if (error.code === 'ENOENT') return {};
            throw error;
        }
    }
    function save(data) {
        if (!file) throw new Error('Session storage is unavailable; the repository selection cannot be saved.');
        mkdirSync(dirname(file), { recursive: true });
        const temporary = `${file}.tmp`;
        writeFileSync(temporary, `${JSON.stringify(data)}\n`, { mode: 0o600 });
        renameSync(temporary, file);
    }
    return {
        read() {
            const { root } = load();
            return root ? validateRoot(root) : null;
        },
        clear() {
            if (!file) return;
            const data = load();
            if (data.coordinatedSessions) save({ coordinatedSessions: data.coordinatedSessions });
            else rmSync(file, { force: true });
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
            const { coordinatedSessions } = load();
            save({ root, ...(source ? { source } : {}), ...(coordinatedSessions ? { coordinatedSessions } : {}) });
        },
        sessions() {
            const { coordinatedSessions } = load();
            return Array.isArray(coordinatedSessions) ? coordinatedSessions : [];
        },
        writeSessions(coordinatedSessions, root, source) {
            save({ ...(root ? { root } : {}), ...(source ? { source } : {}), coordinatedSessions });
        },
    };
}

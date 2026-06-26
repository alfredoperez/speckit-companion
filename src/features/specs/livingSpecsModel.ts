import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Node-side reader for the `livingSpecs` block of `.specify/companion.yml`.
 *
 * Mirrors the listing rules of `speckit-extension/scripts/resolve-spec-paths.py`
 * (and `companion_config.py`) in TypeScript so the Spec Explorer view needs no
 * Python runtime. Only the *listing* slice is reproduced: capability spec-path
 * resolution, tier-sibling existence, and orphan discovery.
 */

const DEFAULT_CAPABILITY_ROOT = 'capabilities';

/** Reserved tier siblings, keyed by kind. Single source of truth for suffixes. */
const TIER_SUFFIXES: Record<TierKind, string> = {
    arch: '.arch.md',
    coverage: '.coverage.md',
};

const RESERVED_TIER_SUFFIXES = Object.values(TIER_SUFFIXES);

export type TierKind = 'arch' | 'coverage';

export interface Tier {
    kind: TierKind;
    /** POSIX repo-relative path of the sibling. */
    path: string;
    exists: boolean;
}

export interface ResolvedCapability {
    name: string;
    /** POSIX repo-relative resolved spec path. */
    spec: string;
    location: 'centralized' | 'colocated';
    exists: boolean;
    /** Architecture/coverage siblings that exist on disk (in arch, coverage order). */
    tiers: Tier[];
}

export interface LivingSpecsListing {
    enabled: boolean;
    capabilities: ResolvedCapability[];
    orphans: string[];
}

interface RawCapability {
    name: string;
    match: string[];
    exclude: string[];
    /** Resolved spec path; '' flags a declared-but-empty (bad) colocated entry. */
    spec: string;
}

function posix(p: string): string {
    return p.replace(/\\/g, '/');
}

function asList(value: unknown): string[] {
    if (value === null || value === undefined) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(v => v !== null && v !== undefined && v !== '').map(v => String(v));
    }
    return value === '' ? [] : [String(value)];
}

/**
 * Translate a glob into a regex with POSIX-path semantics: a single `*` matches
 * within one segment (never crosses `/`), `**` matches any depth, and a trailing
 * `/**` also matches the bare directory. Mirrors the resolver's `_glob_to_regex`.
 */
function globToRegExp(pattern: string): RegExp {
    const pat = posix(pattern);
    let out = '^';
    let i = 0;
    const n = pat.length;
    while (i < n) {
        const c = pat[i];
        if (c === '*') {
            if (i + 1 < n && pat[i + 1] === '*') {
                if (i + 2 === n && out.endsWith('/')) {
                    // trailing `/**` — also match the bare directory.
                    out = out.slice(0, -1) + '(?:/.*)?';
                    i += 2;
                    continue;
                }
                if (i + 2 < n && pat[i + 2] === '/') {
                    out += '(?:.*/)?';
                    i += 3;
                    continue;
                }
                out += '.*';
                i += 2;
                continue;
            }
            out += '[^/]*';
            i += 1;
        } else if (c === '?') {
            out += '[^/]';
            i += 1;
        } else {
            out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            i += 1;
        }
    }
    return new RegExp(out + '$');
}

function globMatches(pattern: string, file: string): boolean {
    return globToRegExp(pattern).test(posix(file));
}

function parseLivingSpecs(configPath: string): { enabled: boolean; capabilities: RawCapability[] } {
    let block: unknown;
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const doc = yaml.load(raw) as Record<string, unknown> | null;
        block = doc?.livingSpecs;
    } catch {
        return { enabled: false, capabilities: [] };
    }
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return { enabled: false, capabilities: [] };
    }
    const b = block as Record<string, unknown>;
    const enabled = b.enabled === true;
    const rawCaps = Array.isArray(b.capabilities) ? b.capabilities : [];
    const capabilities: RawCapability[] = [];
    for (const entry of rawCaps) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        const name = e.name;
        if (!name) {
            continue;
        }
        const nameStr = String(name);
        let spec: string;
        if ('spec' in e) {
            spec = e.spec === null || e.spec === undefined || e.spec === '' ? '' : String(e.spec);
        } else {
            spec = `${DEFAULT_CAPABILITY_ROOT}/${nameStr}/spec.md`;
        }
        capabilities.push({
            name: nameStr,
            match: asList(e.match),
            exclude: asList(e.exclude),
            spec,
        });
    }
    return { enabled, capabilities };
}

function capLocation(cap: RawCapability): 'centralized' | 'colocated' {
    const expected = `${DEFAULT_CAPABILITY_ROOT}/${cap.name}/spec.md`;
    return posix(cap.spec) === expected ? 'centralized' : 'colocated';
}

/**
 * Derive a capability's reserved-tier sibling paths from its spec path.
 * `capabilities/x/spec.md` -> `capabilities/x/spec.arch.md` / `.coverage.md`;
 * colocated `billing.spec.md` -> `billing.arch.md` / `billing.coverage.md`.
 */
function tierPaths(spec: string, root: string): Tier[] {
    const sp = posix(spec);
    let base: string;
    if (sp.endsWith('.spec.md')) {
        base = sp.slice(0, -'.spec.md'.length);
    } else if (sp.endsWith('.md')) {
        base = sp.slice(0, -'.md'.length);
    } else {
        base = sp;
    }
    return (Object.keys(TIER_SUFFIXES) as TierKind[]).map(kind => {
        const tierPath = base + TIER_SUFFIXES[kind];
        return { kind, path: tierPath, exists: fileExists(root, tierPath) };
    });
}

/**
 * True when `relPath` is repo-relative and resolves inside `root`. Rejects
 * absolute paths and any `..` traversal that escapes the workspace. Spec and
 * orphan paths are always treated as repo-relative.
 */
export function isPathWithinRoot(root: string, relPath: string): boolean {
    if (path.isAbsolute(relPath)) {
        return false;
    }
    const rel = path.relative(root, path.resolve(root, relPath));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function fileExists(root: string, relPath: string): boolean {
    if (!isPathWithinRoot(root, relPath)) {
        return false;
    }
    try {
        return fs.statSync(path.join(root, relPath)).isFile();
    } catch {
        return false;
    }
}

/** Recursively collect repo-relative POSIX paths of every `*.spec.md` under root. */
function globSpecFiles(root: string): string[] {
    const results: string[] = [];
    const walk = (dir: string, rel: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue;
            }
            // `specs/` (feature specs) is excluded from orphans anyway; skip the
            // top-level one so its tree is never walked. Mirrors the resolver,
            // which only excludes a leading `specs` segment, not a nested one.
            if (entry.isDirectory() && rel === '' && entry.name === 'specs') {
                continue;
            }
            const childRel = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name), childRel);
            } else if (entry.isFile() && entry.name.endsWith('.spec.md')) {
                results.push(childRel);
            }
        }
    };
    walk(root, '');
    return results;
}

/**
 * `*.spec.md` files claimed by no capability. Excludes the `specs/` feature
 * folder, reserved tier siblings, claimed spec paths, and any file inside a
 * configured capability's spec directory. Mirrors the resolver's `find_orphans`.
 */
function findOrphans(caps: RawCapability[], root: string): string[] {
    const claimed = new Set(
        caps.filter(c => c.spec !== '').map(c => posix(c.spec))
    );
    const ownedDirs = [...claimed].map(c => path.posix.dirname(c)).filter(d => d && d !== '.');
    const orphans: string[] = [];
    for (const rel of globSpecFiles(root)) {
        if (rel.split('/')[0] === 'specs') {
            continue;
        }
        if (RESERVED_TIER_SUFFIXES.some(suffix => rel.endsWith(suffix))) {
            continue;
        }
        if (claimed.has(rel)) {
            continue;
        }
        if (ownedDirs.some(d => rel === d || rel.startsWith(d + '/'))) {
            continue;
        }
        orphans.push(rel);
    }
    return orphans.sort();
}

/**
 * Read and resolve the project's living specs for the Spec Explorer view.
 * Returns an inert, empty listing (no throw) when the config is missing,
 * malformed, or `livingSpecs.enabled` is not true.
 */
export function readLivingSpecs(workspaceRoot: string): LivingSpecsListing {
    const configPath = path.join(workspaceRoot, '.specify', 'companion.yml');
    const { enabled, capabilities } = parseLivingSpecs(configPath);
    if (!enabled) {
        return { enabled: false, capabilities: [], orphans: [] };
    }

    const resolved: ResolvedCapability[] = [];
    const seen = new Set<string>();
    for (const cap of capabilities) {
        if (cap.spec === '') {
            continue; // colocated capability with no resolvable path — skip gracefully
        }
        const specPosix = posix(cap.spec);
        if (!isPathWithinRoot(workspaceRoot, specPosix)) {
            continue; // reject a spec path that escapes the workspace root
        }
        if (seen.has(specPosix)) {
            continue; // de-dupe by resolved spec path
        }
        seen.add(specPosix);
        resolved.push({
            name: cap.name,
            spec: specPosix,
            location: capLocation(cap),
            exists: fileExists(workspaceRoot, specPosix),
            tiers: tierPaths(specPosix, workspaceRoot).filter(t => t.exists),
        });
    }
    resolved.sort((a, b) => a.name.localeCompare(b.name));

    return {
        enabled: true,
        capabilities: resolved,
        orphans: findOrphans(capabilities, workspaceRoot),
    };
}

/** Exposed for membership-rule tests; not used by the listing path directly. */
export const __test = { globMatches, globToRegExp };

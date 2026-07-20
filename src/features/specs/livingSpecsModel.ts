import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Node-side reader for the project's capability registry.
 *
 * Mirrors the listing rules of `speckit-extension/scripts/resolve-spec-paths.py`
 * (and `companion_config.py`) in TypeScript so the Living Specs view needs no
 * Python runtime. Only the *listing* slice is reproduced: capability spec-path
 * resolution, tier-sibling existence, and orphan discovery.
 */

const DEFAULT_CAPABILITY_ROOT = 'capabilities';

/** The capability registry, at the project root — outside the folder `git restore .specify/` sweeps. */
export const LIVING_SPECS_REL = 'living-specs.yml';

/** Where capability registrations used to live; still read when no registry exists. */
export const LEGACY_CONFIG_REL = path.join('.specify', 'companion.yml');

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
    /** Membership globs, carried for health computation. */
    match: string[];
    exclude: string[];
}

/**
 * Per-capability derived health for the Living Specs row. Fields are absent
 * (not zeroed) whenever they cannot be computed — a missing count must be
 * indistinguishable from "no coverage tier".
 */
export interface CapabilityHealth {
    /** From the coverage tier: requirements with a mapped test / total. */
    coverage?: { covered: number; total: number };
    /** True when files matching the capability changed since its spec's last commit. */
    drifted?: boolean;
}

export interface LivingSpecsListing {
    enabled: boolean;
    capabilities: ResolvedCapability[];
    orphans: string[];
    /** True when the registry answered and a capability block still lingers in the legacy config. */
    legacyStale: boolean;
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

function isMapping(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Read a YAML file into a mapping; `undefined` when it is absent or will not parse. */
function readMapping(file: string): Record<string, unknown> | undefined {
    try {
        const doc = yaml.load(fs.readFileSync(file, 'utf-8'));
        return isMapping(doc) ? doc : undefined;
    } catch {
        return undefined;
    }
}

function normalizeBlock(block: unknown): { enabled: boolean; capabilities: RawCapability[] } {
    if (isMapping(block) && isMapping(block.livingSpecs)) {
        block = block.livingSpecs;
    }
    if (!isMapping(block)) {
        return { enabled: false, capabilities: [] };
    }
    const enabled = block.enabled === true;
    const rawCaps = Array.isArray(block.capabilities) ? block.capabilities : [];
    const capabilities: RawCapability[] = [];
    for (const entry of rawCaps) {
        if (!isMapping(entry) || !entry.name) {
            continue;
        }
        const name = String(entry.name);
        let spec: string;
        if ('spec' in entry) {
            spec = entry.spec === null || entry.spec === undefined || entry.spec === '' ? '' : String(entry.spec);
        } else {
            spec = `${DEFAULT_CAPABILITY_ROOT}/${name}/spec.md`;
        }
        capabilities.push({
            name,
            match: asList(entry.match),
            exclude: asList(entry.exclude),
            spec,
        });
    }
    return { enabled, capabilities };
}

interface RegistryResolution {
    enabled: boolean;
    capabilities: RawCapability[];
    legacyStale: boolean;
}

/**
 * Resolve where this project keeps its capabilities. The registry file wins outright
 * whenever it is present — including when it will not parse, which yields an inert
 * result rather than a fallback that would resurrect a set the person replaced.
 * Mirrors `companion_config.resolve_living_specs`.
 */
function resolveRegistry(workspaceRoot: string): RegistryResolution {
    const registryFile = path.join(workspaceRoot, LIVING_SPECS_REL);
    const legacyFile = path.join(workspaceRoot, LEGACY_CONFIG_REL);
    const legacyBlock = readMapping(legacyFile)?.livingSpecs;
    const legacyHasBlock = isMapping(legacyBlock);

    if (fs.existsSync(registryFile)) {
        const doc = readMapping(registryFile);
        const parsed = doc ? normalizeBlock(doc) : { enabled: false, capabilities: [] };
        return { ...parsed, legacyStale: legacyHasBlock };
    }
    if (legacyHasBlock) {
        return { ...normalizeBlock(legacyBlock), legacyStale: false };
    }
    return { enabled: false, capabilities: [], legacyStale: false };
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

function isProjectRoot(dir: string): boolean {
    for (const rel of [LIVING_SPECS_REL, LEGACY_CONFIG_REL]) {
        try {
            if (fs.statSync(path.join(dir, rel)).isFile()) {
                return true;
            }
        } catch (e) {
            // Only a confirmed absence means "not a project"; an unreadable config still bounds the scan.
            if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                return true;
            }
        }
    }
    return false;
}

/**
 * Repo-relative POSIX paths of every `*.spec.md` belonging to this project.
 * A subdirectory carrying its own registry or legacy config is a separate
 * project and is pruned; `root`'s own config is not a boundary against itself.
 */
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
            const childDir = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (isProjectRoot(childDir)) {
                    continue;
                }
                walk(childDir, childRel);
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
 * folder, nested projects, reserved tier siblings, claimed spec paths, and any
 * file inside a configured capability's spec directory. Mirrors the resolver's
 * `find_orphans`.
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
 * Read and resolve the project's living specs for the Living Specs view.
 * Returns an inert, empty listing (no throw) when the config is missing,
 * malformed, or `livingSpecs.enabled` is not true.
 */
export function readLivingSpecs(
    workspaceRoot: string,
    options?: { withOrphans?: boolean }
): LivingSpecsListing {
    const { enabled, capabilities, legacyStale } = resolveRegistry(workspaceRoot);
    if (!enabled) {
        return { enabled: false, capabilities: [], orphans: [], legacyStale };
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
            match: cap.match,
            exclude: cap.exclude,
        });
    }
    resolved.sort((a, b) => a.name.localeCompare(b.name));

    return {
        enabled: true,
        capabilities: resolved,
        // Orphan discovery walks the workspace — callers that only need name
        // resolution (the viewer's per-render enrichment) skip it.
        orphans: options?.withOrphans === false ? [] : findOrphans(capabilities, workspaceRoot),
        legacyStale,
    };
}

// --- Capability health (coverage count + drift) ------------------------------
//
// TS mirrors of the CLI rules in `check-coverage.py` and `drift.py`, kept
// best-effort: any read/parse/git failure yields an absent field, never a
// zeroed or guessed one, so the tree renders exactly as before on any miss.

/** Drift exempt-globs mirroring the CLI defaults. */
const DEFAULT_EXEMPT_GLOBS = ['*.config.*', '*.test.*', '**/migrations/**'];

const REQUIREMENT_ID_RE = /\bN?FR-\d+\b/g;

/**
 * The distinct requirement identifiers a spec declares, ignoring fenced code
 * blocks so an example in a snippet is never counted as a requirement. The one
 * derivation behind both the coverage denominator and the viewer's count — two
 * regexes over the same text would eventually disagree.
 */
export function requirementIds(specText: string): string[] {
    const kept: string[] = [];
    let inFence = false;
    for (const line of specText.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence) kept.push(line);
    }
    return [...new Set(kept.join('\n').match(REQUIREMENT_ID_RE) ?? [])];
}

/** A coverage line "names a test" per the CLI rule. */
const TEST_REF_RE = /(\.test\.|\.spec\.|(^|[\s`(])tests\/|::)/;

/** Injectable git runner so tests never need a real repository. */
export type GitRunner = (args: string[], cwd: string) => Promise<string>;

/** Default runner factory: the process timeout matches the caller's timeoutMs,
 * so a timed-out race never leaves git running in the background. */
function makeDefaultGitRunner(timeoutMs: number): GitRunner {
    return (args: string[], cwd: string): Promise<string> => {
        const { execFile } = require('child_process');
        return new Promise((resolve, reject) => {
            execFile('git', args, { cwd, timeout: timeoutMs }, (err: Error | null, stdout: string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout);
                }
            });
        });
    };
}

function readCoverageCount(root: string, cap: ResolvedCapability): CapabilityHealth['coverage'] {
    const coverageTier = tierPaths(cap.spec, root).find(t => t.kind === 'coverage');
    if (!coverageTier?.exists || !cap.exists) {
        return undefined;
    }
    try {
        const specText = fs.readFileSync(path.join(root, cap.spec), 'utf-8');
        const ids = requirementIds(specText);
        if (ids.length === 0) {
            return undefined;
        }
        const coverageLines = fs
            .readFileSync(path.join(root, coverageTier.path), 'utf-8')
            .split('\n')
            .filter(line => TEST_REF_RE.test(line));
        const covered = ids.filter(id => coverageLines.some(line => line.includes(id))).length;
        return { covered, total: ids.length };
    } catch {
        return undefined;
    }
}

async function readDrifted(
    root: string,
    cap: ResolvedCapability,
    git: GitRunner,
): Promise<boolean | undefined> {
    if (!cap.exists || cap.match.length === 0) {
        return undefined;
    }
    try {
        const commit = (await git(['log', '-1', '--format=%H', '--', cap.spec], root)).trim();
        if (!commit) {
            return undefined; // spec never committed — drift is undefined, not false
        }
        const changed = (await git(['diff', '--name-only', `${commit}..HEAD`], root))
            .split('\n')
            .map(f => f.trim())
            .filter(Boolean);
        const ownFiles = new Set([cap.spec, ...tierPaths(cap.spec, root).map(t => t.path)]);
        const drifted = changed.some(file =>
            cap.match.some(g => globMatches(g, file)) &&
            !cap.exclude.some(g => globMatches(g, file)) &&
            !DEFAULT_EXEMPT_GLOBS.some(g => globMatches(g, file) || globMatches(`**/${g}`, file)) &&
            !ownFiles.has(posix(file))
        );
        return drifted;
    } catch {
        return undefined; // no git, not a repo, timeout — silently absent
    }
}

/**
 * Compute a capability's row health: coverage count (filesystem only) and a
 * drift boolean (one time-bounded git call). Never rejects — every failure
 * path resolves with the field absent.
 */
export async function readCapabilityHealth(
    workspaceRoot: string,
    cap: ResolvedCapability,
    opts?: { timeoutMs?: number; git?: GitRunner },
): Promise<CapabilityHealth> {
    const health: CapabilityHealth = {};
    const coverage = readCoverageCount(workspaceRoot, cap);
    if (coverage) {
        health.coverage = coverage;
    }
    const timeoutMs = opts?.timeoutMs ?? 1500;
    // Typed loosely because tsc and ts-jest resolve setTimeout against different libs.
    let timer: unknown;
    const drifted = await Promise.race([
        readDrifted(workspaceRoot, cap, opts?.git ?? makeDefaultGitRunner(timeoutMs)),
        new Promise<undefined>(resolve => { timer = setTimeout(resolve, timeoutMs); }),
    ])
        .catch(() => undefined)
        .finally(() => clearTimeout(timer as ReturnType<typeof setTimeout>));
    if (drifted !== undefined) {
        health.drifted = drifted;
    }
    return health;
}

/** Exposed for membership-rule tests; not used by the listing path directly. */
export const __test = { globMatches, globToRegExp };

"use strict";
/**
 * Commands — Standalone utility commands
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/commands.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only strict types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const shell_command_projection_cjs_1 = require("./shell-command-projection.cjs");
const security_cjs_1 = require("./security.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ioMod = require("./io.cjs");
const { output, error } = ioMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configLoaderMod = require("./config-loader.cjs");
const { loadConfig, isGitIgnored } = configLoaderMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coreUtilsMod = require("./core-utils.cjs");
const { toPosixPath, generateSlugInternal, extractOneLinerFromBody } = coreUtilsMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const phaseIdMod = require("./phase-id.cjs");
const { normalizePhaseName, comparePhaseNum, extractPhaseToken } = phaseIdMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const phaseLocatorMod = require("./phase-locator.cjs");
const { getArchivedPhaseDirs, findPhaseInternal } = phaseLocatorMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const roadmapParserMod = require("./roadmap-parser.cjs");
const { extractCurrentMilestone, stripShippedMilestones: _stripShippedMilestones, getMilestoneInfo, getMilestonePhaseFilter, getRoadmapPhaseInternal } = roadmapParserMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelResolverMod = require("./model-resolver.cjs");
const { resolveModelInternal, resolveEffortInternal, resolveFastModeInternal, resolveEffortForTier, resolveGranularityInternal, assertValidGranularityOverride } = modelResolverMod;
const model_catalog_cjs_1 = require("./model-catalog.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspace = require("./planning-workspace.cjs");
const { planningDir, planningPaths } = planningWorkspace;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const frontmatter = require("./frontmatter.cjs");
const { extractFrontmatter } = frontmatter;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelProfiles = require("./model-profiles.cjs");
const { MODEL_PROFILES, VALID_PHASE_TYPES } = modelProfiles;
const runtime_slash_cjs_1 = require("./runtime-slash.cjs");
// ─── Phase Status ─────────────────────────────────────────────────────────────
/**
 * Determine phase status by checking plan/summary counts AND verification state.
 * Introduces "Executed" for phases with all summaries but no passing verification.
 */
function determinePhaseStatus(plans, summaries, phaseDir, defaultPending) {
    if (plans === 0)
        return defaultPending;
    if (summaries < plans && summaries > 0)
        return 'In Progress';
    if (summaries < plans)
        return 'Planned';
    // summaries >= plans — check verification
    try {
        const files = node_fs_1.default.readdirSync(phaseDir);
        const verificationFile = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
        if (verificationFile) {
            const content = (0, shell_command_projection_cjs_1.platformReadSync)(node_path_1.default.join(phaseDir, verificationFile)) || '';
            // #1159 (Defect A): read ONLY the frontmatter `status` key to avoid false
            // matches from historical body metadata such as `previous_status: gaps_found`.
            // Full-text regexes like /status:\s*gaps_found/ match the substring inside
            // `previous_status: gaps_found`, producing incorrect phase status labels.
            const fm = extractFrontmatter(content);
            // Normalise to lower-case to preserve the prior case-insensitive behaviour
            // while reading only the frontmatter `status` key (not the full body text).
            const fmStatus = typeof fm['status'] === 'string' ? fm['status'].trim().toLowerCase() : '';
            if (fmStatus === 'passed')
                return 'Complete';
            if (fmStatus === 'human_needed')
                return 'Needs Review';
            if (fmStatus === 'gaps_found')
                return 'Executed';
            // Verification exists but unrecognized status — treat as executed
            return 'Executed';
        }
    }
    catch { /* directory read failed — fall through */ }
    // No verification file — executed but not verified
    return 'Executed';
}
function cmdGenerateSlug(text, raw) {
    if (!text) {
        error('text required for slug generation');
    }
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
    const result = { slug };
    output(result, raw, slug);
}
function cmdCurrentTimestamp(format, raw) {
    const now = new Date();
    let result;
    switch (format) {
        case 'date':
            result = now.toISOString().split('T')[0];
            break;
        case 'filename':
            result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
            break;
        case 'full':
        default:
            result = now.toISOString();
            break;
    }
    output({ timestamp: result }, raw, result);
}
function cmdListTodos(cwd, area, raw) {
    const pendingDir = node_path_1.default.join(planningDir(cwd), 'todos', 'pending');
    let count = 0;
    const todos = [];
    try {
        const files = node_fs_1.default.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const content = (0, shell_command_projection_cjs_1.platformReadSync)(node_path_1.default.join(pendingDir, file));
            if (content === null)
                continue;
            const createdMatch = content.match(/^created:\s*(.+)$/m);
            const titleMatch = content.match(/^title:\s*(.+)$/m);
            const areaMatch = content.match(/^area:\s*(.+)$/m);
            const todoArea = areaMatch ? areaMatch[1].trim() : 'general';
            // Apply area filter if specified
            if (area && todoArea !== area)
                continue;
            count++;
            todos.push({
                file,
                created: createdMatch ? createdMatch[1].trim() : 'unknown',
                title: titleMatch ? titleMatch[1].trim() : 'Untitled',
                area: todoArea,
                path: toPosixPath(node_path_1.default.relative(cwd, node_path_1.default.join(pendingDir, file))),
            });
        }
    }
    catch { /* intentionally empty */ }
    const result = { count, todos };
    output(result, raw, count.toString());
}
/**
 * List captured seeds from .planning/seeds/SEED-*.md for browsing/audit (#441).
 *
 * Unlike audit.scanSeeds (which returns only *unimplemented* seeds for the
 * milestone surface), this lists seeds of every status with the richer fields a
 * human audit needs (scope, trigger, planted date). An optional case-insensitive
 * status filter narrows the set. Seed content is user-controlled, so every
 * displayed field is passed through sanitizeForDisplay and each file path is
 * validated with requireSafePath before reading. Read-only — never mutates.
 */
/**
 * Derive the canonical `{ seed_id, slug }` from a seed filename stem and the
 * frontmatter `id:` value. Pure (no I/O) so it can be property-tested directly.
 *
 * seed_id: frontmatter `id:` when it matches `SEED-NNN`, else the numeric prefix
 * of the filename (`SEED-NNN-…`), else the whole stem. slug: the descriptive
 * remainder after `SEED-NNN-`, else the stem with a leading `SEED-` stripped.
 * `rawFmId` is `unknown` because frontmatter values are not guaranteed strings.
 */
function deriveSeedIdentity(stem, rawFmId) {
    const fmId = typeof rawFmId === 'string' ? rawFmId.trim() : '';
    let seedId;
    if (/^SEED-\d+$/i.test(fmId)) {
        seedId = fmId;
    }
    else {
        const numMatch = stem.match(/^(SEED-\d+)/i);
        seedId = numMatch ? numMatch[1] : stem;
    }
    const slugMatch = stem.match(/^SEED-\d+-(.+)$/i);
    const slug = slugMatch ? slugMatch[1] : stem.replace(/^SEED-/i, '');
    return { seed_id: seedId, slug };
}
function cmdListSeeds(cwd, statusFilter, raw) {
    const planDir = planningDir(cwd);
    const seedsDir = node_path_1.default.join(planDir, 'seeds');
    const wantStatus = statusFilter ? statusFilter.trim().toLowerCase() : null;
    const seeds = [];
    const summary = {};
    // Frontmatter values are not guaranteed to be scalars: extractFrontmatter
    // yields {} for a bare `key:` line and an array for `key: [a, b]`. Coerce every
    // read to a string so one malformed seed cannot crash the whole audit list
    // (`.toLowerCase()` on a non-string throws) or leak a raw object/array into the
    // JSON contract. Mirrors the existing `typeof fm.id === 'string'` guard below.
    const fmStr = (v) => (typeof v === 'string' ? v : '');
    let files;
    try {
        files = node_fs_1.default.readdirSync(seedsDir, { withFileTypes: true });
    }
    catch {
        // No seeds dir (or unreadable) — an empty, non-error result. The seed dir is
        // created lazily by the first plant-seed, so absence is the normal zero case.
        output({ count: 0, seeds: [], summary: {} }, raw, '0');
        return;
    }
    for (const entry of files) {
        if (!entry.isFile())
            continue;
        if (!entry.name.startsWith('SEED-') || !entry.name.endsWith('.md'))
            continue;
        let safeFilePath;
        try {
            safeFilePath = (0, security_cjs_1.requireSafePath)(node_path_1.default.join(seedsDir, entry.name), planDir, 'seed file', { allowAbsolute: true });
        }
        catch {
            continue;
        }
        const content = (0, shell_command_projection_cjs_1.platformReadSync)(safeFilePath);
        if (content === null)
            continue;
        const fm = extractFrontmatter(content);
        const status = (fmStr(fm.status) || 'dormant').toLowerCase().trim() || 'dormant';
        // Match on the raw lowercased status (both sides already normalized);
        // sanitizeForDisplay is for output, not comparison.
        if (wantStatus && status !== wantStatus)
            continue;
        // Canonical seed id is `SEED-NNN` (frontmatter `id:`, e.g. SEED-001). Fall
        // back to the numeric prefix of the filename, then to the whole stem. The
        // descriptive remainder of the filename (`SEED-NNN-<slug>.md`) is the slug.
        const stem = node_path_1.default.basename(entry.name, '.md');
        const { seed_id: seedId, slug } = deriveSeedIdentity(stem, fm.id);
        let title = (0, security_cjs_1.sanitizeForDisplay)(fmStr(fm.title).slice(0, 100));
        if (!title) {
            const headingMatch = content.match(/^#\s*(.+)$/m);
            if (headingMatch)
                title = (0, security_cjs_1.sanitizeForDisplay)(headingMatch[1].trim().slice(0, 100));
        }
        const safeStatus = (0, security_cjs_1.sanitizeForDisplay)(status);
        summary[safeStatus] = (summary[safeStatus] || 0) + 1;
        seeds.push({
            seed_id: (0, security_cjs_1.sanitizeForDisplay)(seedId),
            slug: (0, security_cjs_1.sanitizeForDisplay)(slug),
            status: safeStatus,
            scope: (0, security_cjs_1.sanitizeForDisplay)(fmStr(fm.scope) || 'unknown'),
            trigger_when: (0, security_cjs_1.sanitizeForDisplay)(fmStr(fm.trigger_when)),
            planted: (0, security_cjs_1.sanitizeForDisplay)(fmStr(fm.planted)),
            title,
            path: toPosixPath(node_path_1.default.relative(cwd, safeFilePath)),
        });
    }
    // Stable order: by seed_id so output is deterministic across filesystems.
    seeds.sort((a, b) => a.seed_id.localeCompare(b.seed_id));
    output({ count: seeds.length, seeds, summary }, raw, seeds.length.toString());
}
function cmdVerifyPathExists(cwd, targetPath, raw) {
    if (!targetPath) {
        error('path required for verification');
    }
    // Reject null bytes and validate path does not contain traversal attempts
    if (targetPath.includes('\0')) {
        error('path contains null bytes');
    }
    const fullPath = node_path_1.default.isAbsolute(targetPath) ? targetPath : node_path_1.default.join(cwd, targetPath);
    try {
        const stats = node_fs_1.default.statSync(fullPath);
        const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
        const result = { exists: true, type };
        output(result, raw, 'true');
    }
    catch {
        const result = { exists: false, type: null };
        output(result, raw, 'false');
    }
}
function cmdHistoryDigest(cwd, raw) {
    const phasesDir = planningPaths(cwd).phases;
    const digest = { phases: {}, decisions: [], tech_stack: new Set() };
    // Collect all phase directories: archived + current
    const allPhaseDirs = [];
    // Add archived phases first (oldest milestones first)
    const archived = getArchivedPhaseDirs(cwd);
    for (const a of archived) {
        allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
    }
    // Add current phases
    if (node_fs_1.default.existsSync(phasesDir)) {
        try {
            const currentDirs = node_fs_1.default.readdirSync(phasesDir, { withFileTypes: true })
                .filter(e => e.isDirectory())
                .map(e => e.name)
                .sort();
            for (const dir of currentDirs) {
                allPhaseDirs.push({ name: dir, fullPath: node_path_1.default.join(phasesDir, dir), milestone: null });
            }
        }
        catch { /* intentionally empty */ }
    }
    if (allPhaseDirs.length === 0) {
        digest.tech_stack = [];
        output(digest, raw, undefined);
        return;
    }
    try {
        for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
            const summaries = node_fs_1.default.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
            for (const summary of summaries) {
                const content = (0, shell_command_projection_cjs_1.platformReadSync)(node_path_1.default.join(dirPath, summary));
                if (content === null)
                    continue;
                try {
                    const fm = extractFrontmatter(content);
                    const phaseNum = fm['phase'] || dir.split('-')[0];
                    if (!digest.phases[phaseNum]) {
                        digest.phases[phaseNum] = {
                            name: fm['name'] || dir.split('-').slice(1).join(' ') || 'Unknown',
                            provides: new Set(),
                            affects: new Set(),
                            patterns: new Set(),
                        };
                    }
                    // Merge provides
                    const depGraph = fm['dependency-graph'];
                    if (depGraph && depGraph['provides']) {
                        depGraph['provides'].forEach((p) => digest.phases[phaseNum].provides.add(p));
                    }
                    else if (fm['provides']) {
                        fm['provides'].forEach((p) => digest.phases[phaseNum].provides.add(p));
                    }
                    // Merge affects
                    if (depGraph && depGraph['affects']) {
                        depGraph['affects'].forEach((a) => digest.phases[phaseNum].affects.add(a));
                    }
                    // Merge patterns
                    if (fm['patterns-established']) {
                        fm['patterns-established'].forEach((p) => digest.phases[phaseNum].patterns.add(p));
                    }
                    // Merge decisions
                    if (fm['key-decisions']) {
                        fm['key-decisions'].forEach((d) => {
                            digest.decisions.push({ phase: phaseNum, decision: d });
                        });
                    }
                    // Merge tech stack
                    const techStack = fm['tech-stack'];
                    if (techStack && techStack['added']) {
                        techStack['added'].forEach((t) => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
                    }
                }
                catch {
                    // Skip malformed summaries
                }
            }
        }
        // Convert Sets to Arrays for JSON output
        Object.keys(digest.phases).forEach(p => {
            digest.phases[p].provides = [...digest.phases[p].provides];
            digest.phases[p].affects = [...digest.phases[p].affects];
            digest.phases[p].patterns = [...digest.phases[p].patterns];
        });
        digest.tech_stack = [...digest.tech_stack];
        output(digest, raw, undefined);
    }
    catch (e) {
        error('Failed to generate history digest: ' + e.message);
    }
}
function cmdResolveModel(cwd, agentType, raw) {
    if (!agentType) {
        error('agent-type required');
    }
    const config = loadConfig(cwd);
    const profile = config['model_profile'] || 'balanced';
    const model = resolveModelInternal(cwd, agentType);
    const effort = resolveEffortInternal(cwd, agentType);
    const agentModels = MODEL_PROFILES[agentType];
    const result = agentModels
        ? { model, profile, effort }
        : { model, profile, effort, unknown_agent: true };
    output(result, raw, model);
}
function cmdResolveGranularity(cwd, phaseType, raw, override) {
    if (!phaseType) {
        error('phase-type required');
    }
    assertValidGranularityOverride(override, error);
    const granularity = resolveGranularityInternal(cwd, phaseType, override);
    const result = (VALID_PHASE_TYPES).has(phaseType)
        ? { granularity, phase_type: phaseType }
        : { granularity, phase_type: phaseType, unknown_phase_type: true };
    output(result, raw, granularity);
}
/**
 * #443 — Superset execution query: model + unified effort + fast_mode.
 *
 * Emits JSON:
 *   { model, profile, effort, effort_rendered, effort_param, effort_propagation,
 *     fast_mode, fast_mode_supported, [unknown_agent] }
 *
 * Flags: --effort <level>, --fast-mode <true|false>, --attempt <n>
 */
function cmdResolveExecution(cwd, agentType, raw, opts) {
    if (!agentType) {
        error('agent-type required');
    }
    opts = opts || {};
    const config = loadConfig(cwd);
    const profile = config['model_profile'] || 'balanced';
    const model = resolveModelInternal(cwd, agentType);
    const effortOpts = {};
    if (typeof opts.effortOverride === 'string')
        effortOpts['override'] = opts.effortOverride;
    const fastModeOpts = {};
    if (typeof opts.fastModeOverride === 'boolean')
        fastModeOpts['override'] = opts.fastModeOverride;
    const effort = (opts.attempt !== undefined && opts.attempt !== null)
        ? resolveEffortForTier(cwd, agentType, opts.attempt)
        : resolveEffortInternal(cwd, agentType, effortOpts);
    const fastMode = resolveFastModeInternal(cwd, agentType, fastModeOpts);
    const runtime = config['runtime'] || 'claude';
    const rendered = (0, model_catalog_cjs_1.renderEffortForRuntime)(runtime, effort);
    const fastModeSupported = model_catalog_cjs_1.RUNTIMES_WITH_FAST_MODE.has(runtime);
    const agentModels = MODEL_PROFILES[agentType];
    const result = {
        model,
        profile,
        effort,
        effort_rendered: rendered.value,
        effort_param: rendered.param,
        effort_propagation: rendered.channel,
        fast_mode: fastMode,
        fast_mode_supported: fastModeSupported,
    };
    if (!agentModels)
        result['unknown_agent'] = true;
    output(result, raw, effort);
}
/**
 * #488 — Replace or inject the `effort:` value in YAML frontmatter.
 * Unlike injectEffortFrontmatter (install.js), this overwrites an existing value.
 */
function setEffortFrontmatter(content, effortValue) {
    const eol = /^---\r\n/.test(content) ? '\r\n' : '\n';
    const fmRe = /^---\r?\n([\s\S]*?)^---\r?$/m;
    const match = fmRe.exec(content);
    if (!match)
        return content;
    const fmBody = match[1];
    if (/^effort:/m.test(fmBody)) {
        return content.replace(/^(effort:)[ \t]*.*$/m, `$1 ${effortValue}`);
    }
    const openLen = 3 + eol.length;
    const closingStart = match.index + openLen + fmBody.length;
    return content.slice(0, closingStart) + `effort: ${effortValue}${eol}` + content.slice(closingStart);
}
/**
 * #488 — Re-sync effort: frontmatter in all installed gsd-*.md agent files to
 * match the current effort config, without requiring a full reinstall.
 *
 * Uses install-time resolution (readGsdEffectiveEffortConfig + resolveInstallTimeEffort
 * from bin/install.js) rather than the runtime resolver (resolveEffortInternal), because
 * the sync must mirror what install actually wrote: home defaults merged with project config.
 * The runtime resolver (loadConfig) does not merge ~/.gsd/defaults.json when a project
 * .planning/config.json exists, so it would silently ignore home-level effort changes.
 */
function cmdEffortSync(cwd, raw, opts) {
    opts = opts || {};
    const dryRun = opts.dryRun !== false;
    const config = loadConfig(cwd);
    const runtime = opts.runtime || config['runtime'] || 'claude';
    if (runtime !== 'claude') {
        output({ synced: 0, skipped: 0, changes: [], dry_run: dryRun, reason: `runtime '${runtime}' does not use effort: frontmatter` }, raw, '');
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/unbound-method
    const { getGlobalConfigDir } = require('./runtime-homes.cjs');
    // Use install-time resolvers: they merge ~/.gsd/defaults.json with project config,
    // matching the exact logic used when agents were originally installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/unbound-method
    const { readGsdEffectiveEffortConfig, resolveInstallTimeEffort } = require('../../../bin/install.js');
    const effortCfg = readGsdEffectiveEffortConfig(cwd);
    const agentsDir = node_path_1.default.join(opts.configDir || getGlobalConfigDir(runtime), 'agents');
    if (!node_fs_1.default.existsSync(agentsDir)) {
        output({ synced: 0, skipped: 0, changes: [], dry_run: dryRun, agents_dir: agentsDir, reason: 'agents directory not found' }, raw, '');
        return;
    }
    // Skip symlinks — only write regular files to avoid clobbering symlink targets.
    const files = node_fs_1.default.readdirSync(agentsDir).filter(f => {
        if (!f.startsWith('gsd-') || !f.endsWith('.md'))
            return false;
        try {
            return node_fs_1.default.lstatSync(node_path_1.default.join(agentsDir, f)).isFile();
        }
        catch {
            return false;
        }
    });
    const changes = [];
    let synced = 0;
    let skipped = 0;
    for (const file of files) {
        const agentName = file.replace(/\.md$/, '');
        const filePath = node_path_1.default.join(agentsDir, file);
        const content = node_fs_1.default.readFileSync(filePath, 'utf8');
        // Resolve using install-time logic: home defaults merged with project config.
        const universalEffort = resolveInstallTimeEffort(effortCfg, agentName);
        const rendered = (0, model_catalog_cjs_1.renderEffortForRuntime)(runtime, universalEffort);
        const newEffortValue = rendered.value;
        const fmMatch = /^---\r?\n([\s\S]*?)^---\r?$/m.exec(content);
        if (!fmMatch) {
            skipped++;
            continue;
        }
        const effortMatch = /^effort:[ \t]*(.+?)[ \t]*$/m.exec(fmMatch[1]);
        const currentEffort = effortMatch ? effortMatch[1] : null;
        if (currentEffort === newEffortValue) {
            skipped++;
            continue;
        }
        changes.push({ agent: agentName, from: currentEffort, to: newEffortValue });
        synced++;
        if (!dryRun) {
            node_fs_1.default.writeFileSync(filePath, setEffortFrontmatter(content, newEffortValue));
        }
    }
    output({ synced, skipped, changes, dry_run: dryRun, agents_dir: agentsDir }, raw, synced > 0 ? 'changed' : 'ok');
}
function cmdCommit(cwd, message, files, raw, amend, noVerify) {
    if (!message && !amend) {
        error('commit message required');
    }
    // Sanitize commit message: strip invisible chars and injection markers
    // that could hijack agent context when commit messages are read back
    let sanitizedMessage = message;
    if (sanitizedMessage) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/unbound-method
        const { sanitizeForPrompt } = require('./security.cjs');
        sanitizedMessage = sanitizeForPrompt(sanitizedMessage);
    }
    const config = loadConfig(cwd);
    // Check commit_docs config
    // `skipped: true` is explicit so agent prompts can match on a first-class
    // success signal rather than inferring "skip" from "committed is missing"
    // and improvising raw git fallbacks (#3678).
    if (!config['commit_docs']) {
        const result = { committed: false, skipped: true, hash: null, reason: 'skipped_commit_docs_false' };
        output(result, raw, 'skipped');
        return;
    }
    // Check if .planning is gitignored
    if (isGitIgnored(cwd, '.planning')) {
        const result = { committed: false, skipped: true, hash: null, reason: 'skipped_gitignored' };
        output(result, raw, 'skipped');
        return;
    }
    // Ensure branching strategy branch exists before first commit (#1278).
    // Pre-execution workflows (discuss, plan, research) commit artifacts but the branch
    // was previously only created during execute-phase — too late.
    const branchingStrategy = config['branching_strategy'];
    if (branchingStrategy && branchingStrategy !== 'none') {
        let branchName = null;
        if (branchingStrategy === 'phase') {
            // Determine which phase we're committing for from the file paths
            const phaseMatch = (files || []).join(' ').match(/(\d+(?:\.\d+)*)-/);
            if (phaseMatch) {
                const phaseNum = phaseMatch[1];
                const phaseInfo = findPhaseInternal(cwd, phaseNum);
                if (phaseInfo) {
                    branchName = config['phase_branch_template']
                        .replace('{phase}', normalizePhaseName(phaseInfo['phase_number']))
                        .replace('{slug}', phaseInfo['phase_slug'] || 'phase');
                }
            }
        }
        else if (branchingStrategy === 'milestone') {
            const milestone = getMilestoneInfo(cwd);
            if (milestone && milestone.version) {
                branchName = config['milestone_branch_template']
                    .replace('{milestone}', milestone.version)
                    .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone');
            }
        }
        if (branchName) {
            const currentBranch = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
            if (currentBranch.exitCode === 0 && currentBranch.stdout.trim() !== branchName) {
                // Create branch if it doesn't exist, or switch to it if it does
                const create = (0, shell_command_projection_cjs_1.execGit)(['checkout', '-b', branchName], { cwd });
                if (create.exitCode !== 0) {
                    (0, shell_command_projection_cjs_1.execGit)(['checkout', branchName], { cwd });
                }
            }
        }
    }
    // Stage files
    const explicitFiles = files && files.length > 0;
    const filesToStage = explicitFiles ? files : ['.planning/'];
    for (const file of filesToStage) {
        const fullPath = node_path_1.default.join(cwd, file);
        if (!node_fs_1.default.existsSync(fullPath)) {
            if (explicitFiles) {
                // Caller passed an explicit --files list: missing files are skipped.
                // Staging a deletion here would silently remove tracked planning files
                // (e.g. STATE.md, ROADMAP.md) when they are temporarily absent (#2014).
                continue;
            }
            // Default mode (staging all of .planning/): stage the deletion so
            // removed planning files are not left dangling in the index.
            (0, shell_command_projection_cjs_1.execGit)(['rm', '--cached', '--ignore-unmatch', file], { cwd });
        }
        else {
            (0, shell_command_projection_cjs_1.execGit)(['add', file], { cwd });
        }
    }
    // Commit (--no-verify skips pre-commit hooks, used by parallel executor agents)
    const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', sanitizedMessage];
    if (noVerify)
        commitArgs.push('--no-verify');
    const commitResult = (0, shell_command_projection_cjs_1.execGit)(commitArgs, { cwd });
    if (commitResult.exitCode !== 0) {
        if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
            const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
            output(result, raw, 'nothing');
            return;
        }
        const result = {
            committed: false,
            hash: null,
            reason: 'commit_failed',
            error: commitResult.stderr || commitResult.stdout,
        };
        output(result, raw, 'failed');
        return;
    }
    // Get short hash
    const hashResult = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--short', 'HEAD'], { cwd });
    const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
    const result = { committed: true, hash, reason: 'committed' };
    output(result, raw, hash || 'committed');
}
/**
 * Route a list of changed files to their sub-repo prefixes.
 *
 * Bucket sub-repos by their first path segment (#311). Any file that matches a
 * sub-repo prefix must share that sub-repo's first segment, so we only scan
 * the (small) same-first-segment bucket instead of all sub-repos. Within that
 * bucket all candidates are scanned to find the longest (most-specific)
 * matching prefix, so nested sub_repos (e.g. ['packages', 'packages/core'])
 * route to the deepest match regardless of sub_repos array order (#391).
 *
 * @param files    - changed file paths (relative to project root)
 * @param subRepos - sub-repo path prefixes from config.sub_repos
 */
function groupFilesBySubrepo(files, subRepos) {
    const reposByFirstSeg = new Map();
    for (const repo of subRepos) {
        const firstSeg = String(repo).split('/')[0];
        let bucket = reposByFirstSeg.get(firstSeg);
        if (!bucket) {
            bucket = [];
            reposByFirstSeg.set(firstSeg, bucket);
        }
        bucket.push(repo);
    }
    const grouped = {};
    const unmatched = [];
    for (const file of files) {
        const candidates = reposByFirstSeg.get(file.split('/')[0]);
        // Select the longest (most-specific) matching sub-repo prefix so nested
        // sub_repos (e.g. ['packages', 'packages/core']) route correctly regardless
        // of array order. (#391) String() guards the length read so non-string
        // entries never throw, matching the tolerance of the prior `.find` path.
        let match;
        let matchLen = -1;
        if (candidates) {
            for (const repo of candidates) {
                if (file.startsWith(repo + '/')) {
                    const repoLen = String(repo).length;
                    if (repoLen > matchLen) {
                        match = repo;
                        matchLen = repoLen;
                    }
                }
            }
        }
        if (match) {
            (grouped[match] ||= []).push(file);
        }
        else {
            unmatched.push(file);
        }
    }
    return { grouped, unmatched };
}
function cmdCommitToSubrepo(cwd, message, files, raw) {
    if (!message) {
        error('commit message required');
    }
    const config = loadConfig(cwd);
    const subRepos = config['sub_repos'];
    if (!subRepos || subRepos.length === 0) {
        error('no sub_repos configured in .planning/config.json');
    }
    if (!files || files.length === 0) {
        error('--files required for commit-to-subrepo');
    }
    // Group files by sub-repo prefix
    const { grouped, unmatched } = groupFilesBySubrepo(files, subRepos);
    if (unmatched.length > 0) {
        process.stderr.write(`Warning: ${unmatched.length} file(s) did not match any sub-repo prefix: ${unmatched.join(', ')}\n`);
    }
    const repos = {};
    for (const [repo, repoFiles] of Object.entries(grouped)) {
        const repoCwd = node_path_1.default.join(cwd, repo);
        // Stage files (strip sub-repo prefix for paths relative to that repo)
        for (const file of repoFiles) {
            const relativePath = file.slice(repo.length + 1);
            (0, shell_command_projection_cjs_1.execGit)(['add', relativePath], { cwd: repoCwd });
        }
        // Commit
        const commitResult = (0, shell_command_projection_cjs_1.execGit)(['commit', '-m', message], { cwd: repoCwd });
        if (commitResult.exitCode !== 0) {
            if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
                repos[repo] = { committed: false, hash: null, files: repoFiles, reason: 'nothing_to_commit' };
                continue;
            }
            repos[repo] = { committed: false, hash: null, files: repoFiles, reason: 'error', error: commitResult.stderr };
            continue;
        }
        // Get hash
        const hashResult = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--short', 'HEAD'], { cwd: repoCwd });
        const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
        repos[repo] = { committed: true, hash, files: repoFiles };
    }
    const result = {
        committed: Object.values(repos).some(r => r.committed),
        repos,
        unmatched: unmatched.length > 0 ? unmatched : undefined,
    };
    output(result, raw, Object.entries(repos).map(([r, v]) => `${r}:${v.hash || 'skip'}`).join(' '));
}
/**
 * Prepare a sub-repo for a companion PR branch.
 *
 * Detects uncommitted changes, creates a new branch, stages every changed
 * file explicitly (never git add -A per universal-anti-patterns.md:44), commits,
 * and pushes with --set-upstream. Returns a structured result the workflow uses
 * to call `gh pr create`.
 *
 * On a stage/commit failure (nothing committed yet), the branch is deleted and
 * the caller is returned to the original HEAD so the repo is left clean. On a
 * push failure, the commit already exists — the branch is left in place instead
 * so the user's work is not lost; the error includes a retry instruction.
 */
function cmdPrSubrepo(cwd, repo, branch, commitMessage, raw) {
    if (!repo) {
        error('--repo required');
    }
    if (!branch) {
        error('--branch required');
    }
    if (!commitMessage || commitMessage.startsWith('--')) {
        error('commit message required');
    }
    if (branch.startsWith('-')) {
        error(`Branch name must not start with '-': ${branch}`);
    }
    // 0. Security: validate repo path is contained within the workspace root.
    //    Uses security.cjs validatePath (symlink-safe realpathSync + startsWith guard)
    //    to reject ../escape, absolute paths, and symlink traversal.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/unbound-method
    const { validatePath } = require('./security.cjs');
    const pathCheck = validatePath(repo, cwd);
    if (!pathCheck.safe) {
        error(`Sub-repo path is unsafe: ${pathCheck.error}`);
    }
    const repoCwd = pathCheck.resolved;
    if (!node_fs_1.default.existsSync(repoCwd)) {
        error(`Sub-repo not found: ${repoCwd}`);
    }
    // 1. Collect changed files via porcelain status — explicit, never git add -A.
    //    ?? (untracked) lines are excluded — only stage tracked modifications.
    const statusResult = (0, shell_command_projection_cjs_1.execGit)(['-c', 'core.quotePath=false', 'status', '--porcelain'], { cwd: repoCwd });
    if (statusResult.exitCode !== 0) {
        error(`git status failed in ${repo}: ${statusResult.stderr}`);
    }
    // Parse porcelain output into two lists:
    //   changedFiles — all affected paths (old + new for renames) → goes into result.files
    //   filesToStage — paths to pass to git add (rename old-paths are already staged by
    //                  the rename op and no longer exist in the worktree; only add new paths)
    const changedFiles = [];
    const filesToStage = [];
    for (const line of statusResult.stdout.split('\n').filter(Boolean).filter(l => !l.startsWith('??'))) {
        // execGit trims the entire stdout string, which may strip the leading X-status
        // space from the first output line. Normalize before slicing.
        const normalized = line.trimStart();
        const file = normalized.slice(2).trim();
        const arrowIdx = file.indexOf(' -> ');
        if (arrowIdx !== -1) {
            const oldPath = file.slice(0, arrowIdx).trim();
            const newPath = file.slice(arrowIdx + 4).trim();
            changedFiles.push(oldPath, newPath);
            filesToStage.push(newPath); // old path already staged; worktree no longer has it
        }
        else {
            changedFiles.push(file);
            filesToStage.push(file);
        }
    }
    if (changedFiles.length === 0) {
        output({ ok: true, repo, branch, committed: false, reason: 'nothing_to_commit', files: [] }, raw, 'nothing_to_commit');
        return;
    }
    // 2. Guard: refuse if branch already exists — checkout -b is non-idempotent
    const branchCheck = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--verify', branch], { cwd: repoCwd });
    if (branchCheck.exitCode === 0) {
        error(`Branch already exists in ${repo}: ${branch}. Delete it first or choose a unique name.`);
    }
    // Capture current HEAD before switching so rollback can return explicitly.
    // git checkout - fails on a fresh single-branch repo with no prior HEAD.
    const prevBranchResult = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoCwd });
    const prevBranchName = prevBranchResult.exitCode === 0 ? prevBranchResult.stdout.trim() : null;
    // 3. Create branch
    const checkoutResult = (0, shell_command_projection_cjs_1.execGit)(['checkout', '-b', branch], { cwd: repoCwd });
    if (checkoutResult.exitCode !== 0) {
        error(`Failed to create branch ${branch} in ${repo}: ${checkoutResult.stderr}`);
    }
    // Helper: rollback the created branch and return to the previous HEAD.
    const rollback = () => {
        if (prevBranchName) {
            (0, shell_command_projection_cjs_1.execGit)(['checkout', prevBranchName], { cwd: repoCwd });
        }
        (0, shell_command_projection_cjs_1.execGit)(['branch', '-D', branch], { cwd: repoCwd });
    };
    // 4. Stage explicit files (never git add -A per universal-anti-patterns.md:44)
    for (const file of filesToStage) {
        const addResult = (0, shell_command_projection_cjs_1.execGit)(['add', '--', file], { cwd: repoCwd });
        if (addResult.exitCode !== 0) {
            rollback();
            error(`Failed to stage ${file} in ${repo}: ${addResult.stderr}`);
        }
    }
    // 5. Commit
    const commitResult = (0, shell_command_projection_cjs_1.execGit)(['commit', '-m', commitMessage], { cwd: repoCwd });
    if (commitResult.exitCode !== 0) {
        rollback();
        error(`Failed to commit in ${repo}: ${commitResult.stderr}`);
    }
    // 6. Capture commit hash
    const hashResult = (0, shell_command_projection_cjs_1.execGit)(['rev-parse', '--short', 'HEAD'], { cwd: repoCwd });
    const commitHash = hashResult.exitCode === 0 ? hashResult.stdout.trim() : null;
    // 7. Capture remote URL and derive GitHub owner/repo slug for gh pr create
    const remoteResult = (0, shell_command_projection_cjs_1.execGit)(['remote', 'get-url', 'origin'], { cwd: repoCwd });
    const remoteUrl = remoteResult.exitCode === 0 ? remoteResult.stdout.trim() : null;
    let remoteSlug = null;
    if (remoteUrl) {
        const m = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
        remoteSlug = m ? m[1] : null;
    }
    // 8. Push with --set-upstream so gh pr create can find the branch.
    //    Network operation — use a longer timeout than the default 10 s.
    //    Do NOT rollback on push failure — the commit already exists on the local branch.
    //    Deleting the branch here would destroy the only ref holding the user's work.
    //    Leave the branch in place so the user can retry the push.
    const pushResult = (0, shell_command_projection_cjs_1.execGit)(['push', '--set-upstream', 'origin', branch], { cwd: repoCwd, timeout: 60_000 });
    if (pushResult.exitCode !== 0) {
        error(`Failed to push ${branch} in ${repo}: ${pushResult.stderr}\nBranch ${branch} was created locally — retry with: git -C ${repo} push --set-upstream origin ${branch}`);
    }
    const result = {
        ok: true,
        repo,
        branch,
        committed: true,
        files: changedFiles,
        commit_hash: commitHash,
        remote_url: remoteUrl,
        remote_slug: remoteSlug,
    };
    output(result, raw, `${repo}@${commitHash ?? 'unknown'}`);
}
function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
    if (!summaryPath) {
        error('summary-path required for summary-extract');
    }
    const fullPath = node_path_1.default.join(cwd, summaryPath);
    if (!node_fs_1.default.existsSync(fullPath)) {
        output({ error: 'File not found', path: summaryPath }, raw, undefined);
        return;
    }
    const content = node_fs_1.default.readFileSync(fullPath, 'utf-8');
    const fm = extractFrontmatter(content);
    // Parse key-decisions into structured format
    const parseDecisions = (decisionsList) => {
        if (!decisionsList || !Array.isArray(decisionsList))
            return [];
        return decisionsList.map(d => {
            const colonIdx = d.indexOf(':');
            if (colonIdx > 0) {
                return {
                    summary: d.substring(0, colonIdx).trim(),
                    rationale: d.substring(colonIdx + 1).trim(),
                };
            }
            return { summary: d, rationale: null };
        });
    };
    const techStack = fm['tech-stack'];
    // Build full result
    const fullResult = {
        path: summaryPath,
        one_liner: fm['one-liner'] || extractOneLinerFromBody(content) || null,
        key_files: fm['key-files'] || [],
        tech_added: (techStack && techStack['added']) || [],
        patterns: fm['patterns-established'] || [],
        decisions: parseDecisions(fm['key-decisions']),
        // Tolerate both key forms: the template/reader use kebab `requirements-completed`,
        // but the tool's own JSON output and the milestone audit `--pick` use snake
        // `requirements_completed`. Reading both prevents a snake-keyed SUMMARY (the form the
        // tool emits) from being silently dropped to []. See #628.
        requirements_completed: fm['requirements-completed'] ?? fm['requirements_completed'] ?? [],
    };
    // If fields specified, filter to only those fields
    if (fields && fields.length > 0) {
        const filtered = { path: summaryPath };
        for (const field of fields) {
            if (fullResult[field] !== undefined) {
                filtered[field] = fullResult[field];
            }
        }
        output(filtered, raw, undefined);
        return;
    }
    output(fullResult, raw, undefined);
}
function _wsSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function _wsParseRetryAfter(header) {
    if (!header)
        return null;
    const trimmed = header.trim();
    if (/^\d+$/.test(trimmed)) {
        return Math.min(Math.max(parseInt(trimmed, 10) * 1000, 0), 60000);
    }
    const asDate = Date.parse(trimmed);
    if (!isNaN(asDate)) {
        return Math.min(Math.max(asDate - Date.now(), 0), 60000);
    }
    return null;
}
function _wsRetryDelayMs(attempt) {
    const base = 250;
    const cap = 2000;
    const exp = Math.min(base * Math.pow(2, attempt), cap);
    return exp + Math.floor(Math.random() * 100);
}
async function cmdWebsearch(query, options, raw) {
    const apiKey = process.env['BRAVE_API_KEY'];
    if (!apiKey) {
        // No key = silent skip, agent falls back to built-in WebSearch
        output({ available: false, reason: 'BRAVE_API_KEY not set' }, raw, '');
        return;
    }
    if (!query) {
        output({ available: false, error: 'Query required' }, raw, '');
        return;
    }
    const params = new URLSearchParams({
        q: query,
        count: String(options.limit || 10),
        country: 'us',
        search_lang: 'en',
        text_decorations: 'false'
    });
    if (options.freshness) {
        params.set('freshness', options.freshness);
    }
    const rawTimeout = parseInt(process.env['GSD_WEBSEARCH_TIMEOUT_MS'], 10);
    const timeoutMs = (Number.isInteger(rawTimeout) && rawTimeout > 0) ? rawTimeout : 10000;
    const MAX_RETRIES = 2;
    let attempt = 0;
    while (true) {
        try {
            const ac = new AbortController();
            const timer = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
            let response;
            try {
                response = await fetch(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `https://api.search.brave.com/res/v1/web/search?${params}`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Subscription-Token': apiKey
                    },
                    signal: ac.signal
                });
            }
            finally {
                clearTimeout(timer);
            }
            if (response.ok) {
                const data = await response.json();
                const results = (data.web?.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    description: r.description,
                    age: r.age || null
                }));
                output({
                    available: true,
                    query,
                    count: results.length,
                    results
                }, raw, results.map(r => `${r.title}\n${r.url}\n${r.description}`).join('\n\n'));
                return;
            }
            const status = response.status;
            const isRetryable = status === 429 || status >= 500;
            if (!isRetryable) {
                // Non-retryable 4xx — fail immediately, no attempts field
                output({ available: false, error: `API error: ${status}` }, raw, '');
                return;
            }
            // Retryable HTTP error
            attempt++;
            if (attempt > MAX_RETRIES) {
                output({ available: false, error: `API error: ${status}`, attempts: attempt }, raw, '');
                return;
            }
            let delay;
            if (status === 429) {
                const retryAfter = _wsParseRetryAfter(response.headers.get('retry-after'));
                delay = retryAfter !== null ? retryAfter : _wsRetryDelayMs(attempt - 1);
            }
            else {
                delay = _wsRetryDelayMs(attempt - 1);
            }
            await _wsSleep(delay);
        }
        catch (err) {
            attempt++;
            if (attempt > MAX_RETRIES) {
                output({ available: false, error: err.message, attempts: attempt }, raw, '');
                return;
            }
            await _wsSleep(_wsRetryDelayMs(attempt - 1));
        }
    }
}
function cmdProgressRender(cwd, format, raw) {
    const phasesDir = planningPaths(cwd).phases;
    const milestone = getMilestoneInfo(cwd);
    const phases = [];
    let totalPlans = 0;
    let totalSummaries = 0;
    try {
        const entries = node_fs_1.default.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));
        for (const dir of dirs) {
            const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
            const phaseNum = dm ? dm[1] : dir;
            const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
            const phaseFiles = node_fs_1.default.readdirSync(node_path_1.default.join(phasesDir, dir));
            const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
            const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
            totalPlans += plans;
            totalSummaries += summaries;
            const status = determinePhaseStatus(plans, summaries, node_path_1.default.join(phasesDir, dir), 'Pending');
            phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
        }
    }
    catch { /* intentionally empty */ }
    const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;
    if (format === 'table') {
        // Render markdown table
        const barWidth = 10;
        const filled = Math.round((percent / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        let out = `# ${milestone.version} ${milestone.name}\n\n`;
        out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)\n\n`;
        out += `| Phase | Name | Plans | Status |\n`;
        out += `|-------|------|-------|--------|\n`;
        for (const p of phases) {
            out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
        }
        output({ rendered: out }, raw, out);
    }
    else if (format === 'bar') {
        const barWidth = 20;
        const filled = Math.round((percent / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
        output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
    }
    else {
        // JSON format
        output({
            milestone_version: milestone.version,
            milestone_name: milestone.name,
            phases,
            total_plans: totalPlans,
            total_summaries: totalSummaries,
            percent,
        }, raw, undefined);
    }
}
/**
 * Match pending todos against a phase's goal/name/requirements.
 * Returns todos with relevance scores based on keyword, area, and file overlap.
 * Used by discuss-phase to surface relevant todos before scope-setting.
 */
function cmdTodoMatchPhase(cwd, phase, raw) {
    if (!phase) {
        error('phase required for todo match-phase');
    }
    const pendingDir = node_path_1.default.join(planningDir(cwd), 'todos', 'pending');
    const todos = [];
    // Load pending todos
    try {
        const files = node_fs_1.default.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const content = (0, shell_command_projection_cjs_1.platformReadSync)(node_path_1.default.join(pendingDir, file));
            if (content === null)
                continue;
            const titleMatch = content.match(/^title:\s*(.+)$/m);
            const areaMatch = content.match(/^area:\s*(.+)$/m);
            const filesMatch = content.match(/^files:\s*(.+)$/m);
            const body = content.replace(/^(title|area|files|created|priority):.*$/gm, '').trim();
            todos.push({
                file,
                title: titleMatch ? titleMatch[1].trim() : 'Untitled',
                area: areaMatch ? areaMatch[1].trim() : 'general',
                files: filesMatch ? filesMatch[1].trim().split(/[,\s]+/).filter(Boolean) : [],
                body: body.slice(0, 200), // first 200 chars for context
            });
        }
    }
    catch { /* intentionally empty */ }
    if (todos.length === 0) {
        output({ phase, matches: [], todo_count: 0 }, raw, undefined);
        return;
    }
    // Load phase goal/name from ROADMAP
    const phaseInfo = getRoadmapPhaseInternal(cwd, phase);
    const phaseName = phaseInfo ? (phaseInfo['phase_name'] || '') : '';
    const phaseGoal = phaseInfo ? (phaseInfo['goal'] || '') : '';
    const phaseSection = phaseInfo ? (phaseInfo['section'] || '') : '';
    // Build keyword set from phase name + goal + section text
    const phaseText = `${phaseName} ${phaseGoal} ${phaseSection}`.toLowerCase();
    const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'are', 'was', 'has', 'have', 'been', 'not', 'but', 'all', 'can', 'into', 'each', 'when', 'any', 'use', 'new']);
    const phaseKeywords = new Set(phaseText.split(/[\s\-_/.,;:()\[\]{}|]+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 2 && !stopWords.has(w)));
    // Find phase directory to get expected file paths
    const phaseInfoDisk = findPhaseInternal(cwd, phase);
    const phasePlans = [];
    if (phaseInfoDisk && phaseInfoDisk['found']) {
        try {
            const phaseDir = node_path_1.default.join(cwd, phaseInfoDisk['directory']);
            const planFiles = node_fs_1.default.readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md'));
            for (const pf of planFiles) {
                const planContent = (0, shell_command_projection_cjs_1.platformReadSync)(node_path_1.default.join(phaseDir, pf));
                if (planContent === null)
                    continue;
                const fmFiles = planContent.match(/files_modified:\s*\[([^\]]*)\]/);
                if (fmFiles) {
                    phasePlans.push(...fmFiles[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean));
                }
            }
        }
        catch { /* intentionally empty */ }
    }
    // Score each todo for relevance
    const matches = [];
    for (const todo of todos) {
        let score = 0;
        const reasons = [];
        // Keyword match: todo title/body terms in phase text
        const todoWords = `${todo.title} ${todo.body}`.toLowerCase()
            .split(/[\s\-_/.,;:()\[\]{}|]+/)
            .map(w => w.replace(/[^a-z0-9]/g, ''))
            .filter(w => w.length > 2 && !stopWords.has(w));
        const matchedKeywords = todoWords.filter(w => phaseKeywords.has(w));
        if (matchedKeywords.length > 0) {
            score += Math.min(matchedKeywords.length * 0.2, 0.6);
            reasons.push(`keywords: ${[...new Set(matchedKeywords)].slice(0, 5).join(', ')}`);
        }
        // Area match: todo area appears in phase text
        if (todo.area !== 'general' && phaseText.includes(todo.area.toLowerCase())) {
            score += 0.3;
            reasons.push(`area: ${todo.area}`);
        }
        // File match: todo files overlap with phase plan files
        if (todo.files.length > 0 && phasePlans.length > 0) {
            const fileOverlap = todo.files.filter(f => phasePlans.some(pf => pf.includes(f) || f.includes(pf)));
            if (fileOverlap.length > 0) {
                score += 0.4;
                reasons.push(`files: ${fileOverlap.slice(0, 3).join(', ')}`);
            }
        }
        if (score > 0) {
            matches.push({
                file: todo.file,
                title: todo.title,
                area: todo.area,
                score: Math.round(score * 100) / 100,
                reasons,
            });
        }
    }
    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    output({ phase, matches, todo_count: todos.length }, raw, undefined);
}
function cmdTodoComplete(cwd, filename, raw) {
    if (!filename) {
        error('filename required for todo complete');
    }
    const pendingDir = node_path_1.default.join(planningDir(cwd), 'todos', 'pending');
    const completedDir = node_path_1.default.join(planningDir(cwd), 'todos', 'completed');
    const sourcePath = node_path_1.default.join(pendingDir, filename);
    if (!node_fs_1.default.existsSync(sourcePath)) {
        error(`Todo not found: ${filename}`);
    }
    // Ensure completed directory exists
    (0, shell_command_projection_cjs_1.platformEnsureDir)(completedDir);
    // Read, add completion timestamp, move
    let content = node_fs_1.default.readFileSync(sourcePath, 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    content = `completed: ${today}\n` + content;
    (0, shell_command_projection_cjs_1.platformWriteSync)(node_path_1.default.join(completedDir, filename), content);
    node_fs_1.default.unlinkSync(sourcePath);
    output({ completed: true, file: filename, date: today }, raw, 'completed');
}
function cmdScaffold(cwd, type, options, raw) {
    const { phase, name } = options;
    const padded = phase ? normalizePhaseName(phase) : '00';
    const today = new Date().toISOString().split('T')[0];
    // Find phase directory
    const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
    const phaseDir = phaseInfo ? node_path_1.default.join(cwd, phaseInfo['directory']) : null;
    if (phase && !phaseDir && type !== 'phase-dir') {
        error(`Phase ${phase} directory not found`);
    }
    let filePath, content;
    switch (type) {
        case 'context': {
            filePath = node_path_1.default.join(phaseDir, `${padded}-CONTEXT.md`);
            content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.['phase_name'] || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.['phase_name'] || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during ${String((0, runtime_slash_cjs_1.formatGsdSlash)('discuss-phase', (0, runtime_slash_cjs_1.resolveRuntime)(cwd)))} ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
            break;
        }
        case 'uat': {
            filePath = node_path_1.default.join(phaseDir, `${padded}-UAT.md`);
            content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.['phase_name'] || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.['phase_name'] || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
            break;
        }
        case 'verification': {
            filePath = node_path_1.default.join(phaseDir, `${padded}-VERIFICATION.md`);
            content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.['phase_name'] || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.['phase_name'] || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
            break;
        }
        case 'phase-dir': {
            if (!phase || !name) {
                error('phase and name required for phase-dir scaffold');
            }
            const slug = generateSlugInternal(name);
            // #3287: apply project_code prefix to stay consistent with phase.add/phase.insert
            const scaffoldConfig = loadConfig(cwd);
            const scaffoldProjectCode = scaffoldConfig['project_code'] || '';
            const scaffoldPrefix = scaffoldProjectCode ? `${scaffoldProjectCode}-` : '';
            const dirName = `${scaffoldPrefix}${padded}-${slug}`;
            const phasesParent = planningPaths(cwd).phases;
            (0, shell_command_projection_cjs_1.platformEnsureDir)(phasesParent);
            const dirPath = node_path_1.default.join(phasesParent, dirName);
            (0, shell_command_projection_cjs_1.platformEnsureDir)(dirPath);
            output({ created: true, directory: toPosixPath(node_path_1.default.relative(cwd, dirPath)), path: dirPath }, raw, dirPath);
            return;
        }
        default:
            error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
            // unreachable — error() calls process.exit
            return;
    }
    if (node_fs_1.default.existsSync(filePath)) {
        output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
        return;
    }
    (0, shell_command_projection_cjs_1.platformWriteSync)(filePath, content);
    const relPath = toPosixPath(node_path_1.default.relative(cwd, filePath));
    output({ created: true, path: relPath }, raw, relPath);
}
function cmdStats(cwd, format, raw) {
    const phasesDir = planningPaths(cwd).phases;
    const roadmapPath = planningPaths(cwd).roadmap;
    const reqPath = planningPaths(cwd).requirements;
    const statePath = planningPaths(cwd).state;
    const milestone = getMilestoneInfo(cwd);
    const isDirInMilestone = getMilestonePhaseFilter(cwd);
    // Phase & plan stats (reuse progress pattern)
    const phasesByNumber = new Map();
    let totalPlans = 0;
    let totalSummaries = 0;
    try {
        const roadmapRaw = (0, shell_command_projection_cjs_1.platformReadSync)(roadmapPath);
        if (roadmapRaw === null)
            throw new Error('roadmap missing');
        const roadmapContent = extractCurrentMilestone(roadmapRaw, cwd);
        // Matches both plain numeric (Phase 1:) and milestone-prefixed (Phase 2-01:) headings.
        // Also tolerates optional [bracket-token] scope prefix on phase headings.
        const headingPattern = /#{2,4}\s*(?:\[[^\]]+\]\s*)?Phase\s+([\w][\w.-]*)\s*:\s*([^\n]+)/gi;
        let match;
        while ((match = headingPattern.exec(roadmapContent)) !== null) {
            const key = normalizePhaseName(match[1]);
            phasesByNumber.set(key, {
                number: key,
                name: match[2].replace(/\(INSERTED\)/i, '').trim(),
                plans: 0,
                summaries: 0,
                status: 'Not Started',
            });
        }
    }
    catch { /* intentionally empty */ }
    try {
        const entries = node_fs_1.default.readdirSync(phasesDir, { withFileTypes: true });
        const dirs = entries
            .filter(e => e.isDirectory())
            .map(e => e.name)
            .filter(isDirInMilestone)
            .sort((a, b) => comparePhaseNum(a, b));
        for (const dir of dirs) {
            // Use extractPhaseToken to correctly parse M-NN-style and code-prefixed dir names.
            const phaseToken = extractPhaseToken(dir);
            const phaseNum = phaseToken || dir;
            // phaseName is everything after the token (strip leading '-')
            const afterToken = dir.slice(phaseToken ? phaseToken.length : 0).replace(/^-/, '');
            const phaseName = afterToken ? afterToken.replace(/-/g, ' ') : '';
            const phaseFiles = node_fs_1.default.readdirSync(node_path_1.default.join(phasesDir, dir));
            const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
            const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
            totalPlans += plans;
            totalSummaries += summaries;
            const status = determinePhaseStatus(plans, summaries, node_path_1.default.join(phasesDir, dir), 'Not Started');
            const normalizedNum = normalizePhaseName(phaseNum);
            const existing = phasesByNumber.get(normalizedNum);
            phasesByNumber.set(normalizedNum, {
                number: normalizedNum,
                name: existing?.name || phaseName,
                plans: (existing?.plans || 0) + plans,
                summaries: (existing?.summaries || 0) + summaries,
                status,
            });
        }
    }
    catch { /* intentionally empty */ }
    const phases = [...phasesByNumber.values()].sort((a, b) => comparePhaseNum(a.number, b.number));
    const completedPhases = phases.filter(p => p.status === 'Complete').length;
    const planPercent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;
    const percent = phases.length > 0 ? Math.min(100, Math.round((completedPhases / phases.length) * 100)) : 0;
    // Requirements stats
    let requirementsTotal = 0;
    let requirementsComplete = 0;
    const reqContent = (0, shell_command_projection_cjs_1.platformReadSync)(reqPath);
    if (reqContent !== null) {
        const checked = reqContent.match(/^- \[x\] \*\*/gm);
        const unchecked = reqContent.match(/^- \[ \] \*\*/gm);
        requirementsComplete = checked ? checked.length : 0;
        requirementsTotal = requirementsComplete + (unchecked ? unchecked.length : 0);
    }
    // Last activity from STATE.md
    let lastActivity = null;
    const stateContent = (0, shell_command_projection_cjs_1.platformReadSync)(statePath);
    if (stateContent !== null) {
        const activityMatch = stateContent.match(/^last_activity:\s*(.+)$/im)
            || stateContent.match(/\*\*Last Activity:\*\*\s*(.+)/i)
            || stateContent.match(/^Last Activity:\s*(.+)$/im)
            || stateContent.match(/^Last activity:\s*(.+)$/im);
        if (activityMatch)
            lastActivity = activityMatch[1].trim();
    }
    // Git stats
    let gitCommits = 0;
    let gitFirstCommitDate = null;
    const commitCount = (0, shell_command_projection_cjs_1.execGit)(['rev-list', '--count', 'HEAD'], { cwd });
    if (commitCount.exitCode === 0) {
        gitCommits = parseInt(commitCount.stdout, 10) || 0;
    }
    const rootHash = (0, shell_command_projection_cjs_1.execGit)(['rev-list', '--max-parents=0', 'HEAD'], { cwd });
    if (rootHash.exitCode === 0 && rootHash.stdout) {
        const firstCommit = rootHash.stdout.split('\n')[0].trim();
        const firstDate = (0, shell_command_projection_cjs_1.execGit)(['show', '-s', '--format=%as', firstCommit], { cwd });
        if (firstDate.exitCode === 0) {
            gitFirstCommitDate = firstDate.stdout || null;
        }
    }
    const result = {
        milestone_version: milestone.version,
        milestone_name: milestone.name,
        phases,
        phases_completed: completedPhases,
        phases_total: phases.length,
        total_plans: totalPlans,
        total_summaries: totalSummaries,
        percent,
        plan_percent: planPercent,
        requirements_total: requirementsTotal,
        requirements_complete: requirementsComplete,
        git_commits: gitCommits,
        git_first_commit_date: gitFirstCommitDate,
        last_activity: lastActivity,
    };
    if (format === 'table') {
        const barWidth = 10;
        const filled = Math.round((percent / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        let out = `# ${milestone.version} ${milestone.name} — Statistics\n\n`;
        out += `**Progress:** [${bar}] ${completedPhases}/${phases.length} phases (${percent}%)\n`;
        if (totalPlans > 0) {
            out += `**Plans:** ${totalSummaries}/${totalPlans} complete (${planPercent}%)\n`;
        }
        out += `**Phases:** ${completedPhases}/${phases.length} complete\n`;
        if (requirementsTotal > 0) {
            out += `**Requirements:** ${requirementsComplete}/${requirementsTotal} complete\n`;
        }
        out += '\n';
        out += `| Phase | Name | Plans | Completed | Status |\n`;
        out += `|-------|------|-------|-----------|--------|\n`;
        for (const p of phases) {
            out += `| ${p.number} | ${p.name} | ${p.plans} | ${p.summaries} | ${p.status} |\n`;
        }
        if (gitCommits > 0) {
            out += `\n**Git:** ${gitCommits} commits`;
            if (gitFirstCommitDate)
                out += ` (since ${gitFirstCommitDate})`;
            out += '\n';
        }
        if (lastActivity)
            out += `**Last activity:** ${lastActivity}\n`;
        output({ rendered: out }, raw, out);
    }
    else {
        output(result, raw, undefined);
    }
}
/**
 * Check whether a commit should be allowed based on commit_docs config.
 * When commit_docs is false, rejects commits that stage .planning/ files.
 * Intended for use as a pre-commit hook guard.
 */
function cmdCheckCommit(cwd, raw) {
    const config = loadConfig(cwd);
    // If commit_docs is true (or not set), allow all commits
    if (config['commit_docs'] !== false) {
        output({ allowed: true, reason: 'commit_docs_enabled' }, raw, 'allowed');
        return;
    }
    // commit_docs is false — check if any .planning/ files are staged
    const stagedResult = (0, shell_command_projection_cjs_1.execGit)(['diff', '--cached', '--name-only'], { cwd });
    if (stagedResult.exitCode === 0) {
        const planningFiles = stagedResult.stdout.split('\n').filter(f => f.startsWith('.planning/') || f.startsWith('.planning\\'));
        if (planningFiles.length > 0) {
            error(`commit_docs is false but ${planningFiles.length} .planning/ file(s) are staged:\n` +
                planningFiles.map(f => `  ${f}`).join('\n') +
                `\n\nTo unstage: git reset HEAD ${planningFiles.join(' ')}`);
        }
    }
    // exitCode !== 0 → no staged files or not a git repo — allow
    output({ allowed: true, reason: 'no_planning_files_staged' }, raw, 'allowed');
}
module.exports = {
    groupFilesBySubrepo,
    determinePhaseStatus,
    cmdGenerateSlug,
    cmdCurrentTimestamp,
    cmdListTodos,
    cmdListSeeds,
    deriveSeedIdentity,
    cmdVerifyPathExists,
    cmdHistoryDigest,
    cmdResolveModel,
    cmdResolveGranularity,
    cmdResolveExecution,
    cmdEffortSync,
    cmdCommit,
    cmdCommitToSubrepo,
    cmdPrSubrepo,
    cmdSummaryExtract,
    cmdWebsearch,
    cmdProgressRender,
    cmdTodoComplete,
    cmdTodoMatchPhase,
    cmdScaffold,
    cmdStats,
    cmdCheckCommit,
    _wsParseRetryAfter,
};

"use strict";
/**
 * Check subcommand router — auto-mode, decision-coverage-plan, decision-coverage-verify.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/check-command-router.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only strict types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const io = require("./io.cjs");
const { output, error, ERROR_REASON } = io;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspaceMod = require("./planning-workspace.cjs");
const { planningDir } = planningWorkspaceMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const phaseLocatorMod = require("./phase-locator.cjs");
const { findPhaseInternal } = phaseLocatorMod;
const decisions_cjs_1 = require("./decisions.cjs");
const markdown_sectionizer_cjs_1 = require("./markdown-sectionizer.cjs");
const ui_safety_gate_cjs_1 = require("./ui-safety-gate.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const verifyModule = require("./verify.cjs");
const { cmdVerifySchemaDrift, cmdVerifyCodebaseDrift } = verifyModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const roadmapModule = require("./roadmap.cjs");
const { getRoadmapPhaseWithFallback } = roadmapModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gapCheckerModule = require("./gap-checker.cjs");
const { runGapAnalysis } = gapCheckerModule;
const prohibition_enforcement_cjs_1 = require("./prohibition-enforcement.cjs");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhrase(text) {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
const SOFT_PHRASE_MIN_WORDS = 6;
function softPhrase(text) {
    const words = normalizePhrase(text).split(' ').filter(Boolean);
    if (words.length < SOFT_PHRASE_MIN_WORDS)
        return '';
    return words.slice(0, SOFT_PHRASE_MIN_WORDS).join(' ');
}
function decisionMentioned(haystack, decision) {
    if (!haystack)
        return false;
    if (new RegExp(`\\b${decision.id}\\b`).test(haystack))
        return true;
    const phrase = softPhrase(decision.text);
    return phrase ? normalizePhrase(haystack).includes(phrase) : false;
}
function readIfExists(filePath) {
    try {
        return node_fs_1.default.readFileSync(filePath, 'utf-8');
    }
    catch {
        return '';
    }
}
function resolvePath(inputPath, projectDir) {
    return node_path_1.default.isAbsolute(inputPath) ? inputPath : node_path_1.default.join(projectDir, inputPath);
}
function readWorkflowConfig(projectDir) {
    const configPath = node_path_1.default.join(projectDir, '.planning', 'config.json');
    try {
        const parsed = JSON.parse(node_fs_1.default.readFileSync(configPath, 'utf-8'));
        const wf = parsed['workflow'] || {};
        return {
            ...wf,
            auto_advance: (wf['auto_advance'] ?? parsed['auto_advance']),
            _auto_chain_active: (wf['_auto_chain_active'] ?? parsed['_auto_chain_active']),
            context_coverage_gate: (wf['context_coverage_gate'] ?? parsed['context_coverage_gate']),
        };
    }
    catch {
        return {};
    }
}
function cmdAutoMode(projectDir, raw) {
    const workflow = readWorkflowConfig(projectDir);
    const autoAdvance = Boolean(workflow.auto_advance ?? false);
    const autoChainActive = Boolean(workflow._auto_chain_active ?? false);
    let source = 'none';
    if (autoChainActive && autoAdvance)
        source = 'both';
    else if (autoChainActive)
        source = 'auto_chain';
    else if (autoAdvance)
        source = 'auto_advance';
    output({
        active: autoChainActive || autoAdvance,
        source,
        auto_chain_active: autoChainActive,
        auto_advance: autoAdvance,
    }, raw, undefined);
}
function gateEnabled(projectDir) {
    const value = readWorkflowConfig(projectDir).context_coverage_gate;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'false' || lower === 'true')
            return lower !== 'false';
    }
    return true;
}
function loadPlanContents(phaseDir) {
    if (!node_fs_1.default.existsSync(phaseDir))
        return [];
    try {
        return node_fs_1.default.readdirSync(phaseDir)
            .filter((entry) => /-PLAN\.md$/.test(entry))
            .map((entry) => readIfExists(node_path_1.default.join(phaseDir, entry)));
    }
    catch {
        return [];
    }
}
const DESIGNATED_HEADINGS_RE = /^#{1,6}\s+(?:must[_ ]haves?|truths?|tasks?|objective)\b/i;
const XML_DECISION_TAGS_RE = /<(?:objective|tasks?|action)(?:\s[^>]*)?>([\s\S]*?)<\/(?:objective|tasks?|action)>/gi;
function stripCommentsAndFences(text) {
    // HTML-comment stripping stays caller-side (the seam does not strip HTML comments).
    const htmlStripped = text.replace(/<!--[\s\S]*?-->/g, ' ');
    // Fenced-code stripping: delegate to the canonical CommonMark-correct seam.
    // replaces the prior independent regex copy (```` ``` ``` ````  + `~~~ ~~~`).
    return (0, markdown_sectionizer_cjs_1.stripFencedCode)(htmlStripped).text;
}
function extractYamlBlock(frontmatter, key) {
    const match = frontmatter.match(new RegExp(`^${key}\\s*:(.*)$`, 'm'));
    if (!match)
        return '';
    const startIdx = (match.index || 0) + match[0].length;
    const rest = frontmatter.slice(startIdx + 1).split(/\r?\n/);
    const block = [match[1] || ''];
    for (const line of rest) {
        if (line === '' || /^\s/.test(line))
            block.push(line);
        else
            break;
    }
    return block.join('\n');
}
function extractXmlTagBodies(text) {
    const parts = [];
    for (const match of text.matchAll(XML_DECISION_TAGS_RE)) {
        if (match[1])
            parts.push(match[1]);
    }
    return parts.join('\n');
}
function extractPlanDesignatedSections(planContent) {
    if (!planContent)
        return '';
    const cleaned = stripCommentsAndFences(planContent);
    const fmMatch = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const frontmatter = fmMatch ? fmMatch[1] : '';
    const body = fmMatch ? fmMatch[2] : cleaned;
    const parts = [];
    for (const key of ['must_haves', 'truths', 'objective']) {
        const block = extractYamlBlock(frontmatter, key);
        if (block)
            parts.push(block);
    }
    // Replace hand-rolled split(/\r?\n/) + heading walk with the seam's collectSections.
    // stopPredicate fires on EVERY heading (collectSections needs to start a section at
    // each heading), then we filter to designated ones — same semantics as the prior
    // inDesignated flag: emit the heading line + body only when DESIGNATED_HEADINGS_RE matches.
    const sections = (0, markdown_sectionizer_cjs_1.collectSections)(body, () => true);
    const bodyParts = [];
    for (const section of sections) {
        const headingLine = '#'.repeat(section.heading.level) + ' ' + section.heading.text;
        if (DESIGNATED_HEADINGS_RE.test(headingLine)) {
            bodyParts.push(headingLine);
            if (section.body)
                bodyParts.push(section.body);
        }
    }
    parts.push(bodyParts.join('\n'));
    parts.push(extractXmlTagBodies(cleaned));
    return parts.join('\n\n');
}
function buildPlanMessage(uncovered) {
    if (uncovered.length === 0)
        return 'All trackable CONTEXT.md decisions are covered by plans.';
    return [
        '## Decision Coverage Gap',
        '',
        `${uncovered.length} CONTEXT.md decision(s) are not covered by any plan:`,
        '',
        ...uncovered.map((item) => `- **${item.id}** (${item.category || 'uncategorized'}): ${item.text}`),
        '',
        'Resolve by citing `D-NN:` in a relevant plan\'s `must_haves`/`truths` (or body),',
        'OR move the decision to `### Claude\'s Discretion` / tag it `[informational]` if it should not be tracked.',
    ].join('\n');
}
function buildVerifyMessage(notHonored) {
    if (notHonored.length === 0)
        return 'All trackable CONTEXT.md decisions are honored by shipped artifacts.';
    return [
        '### Decision Coverage (warning)',
        '',
        `${notHonored.length} decision(s) not found in shipped artifacts:`,
        '',
        ...notHonored.map((item) => `- **${item.id}** (${item.category || 'uncategorized'}): ${item.text}`),
        '',
        'This is a soft warning - verification status is unchanged.',
    ].join('\n');
}
function loadDecisionExtraction(contextPath) {
    const extraction = (0, decisions_cjs_1.extractDecisions)(readIfExists(contextPath));
    return {
        trackable: extraction.decisions.filter((d) => d.trackable),
        outcome: extraction.outcome,
    };
}
function cmdDecisionCoveragePlan(projectDir, args, raw) {
    const phaseDir = args[2] ? resolvePath(args[2], projectDir) : '';
    const contextPath = args[3] ? resolvePath(args[3], projectDir) : '';
    if (!gateEnabled(projectDir)) {
        output({ passed: true, skipped: true, reason: 'workflow.context_coverage_gate is false', total: 0, covered: 0, uncovered: [], message: 'Decision coverage gate disabled by config.' }, raw, undefined);
        return;
    }
    if (!contextPath || !node_fs_1.default.existsSync(contextPath)) {
        output({ passed: true, skipped: true, reason: 'CONTEXT.md missing', total: 0, covered: 0, uncovered: [], message: 'No CONTEXT.md - nothing to check.' }, raw, undefined);
        return;
    }
    const { trackable: decisions, outcome } = loadDecisionExtraction(contextPath);
    // #1365 fail-loud gate: any could-not-parse outcome must NOT silently pass —
    // even when some decisions were extracted (e.g. D-01 valid but D-02 malformed).
    // A parse-miss on ANY bullet means the gate cannot certify full coverage.
    // Fire independent of decisions.length so a partial-parse still blocks.
    if (outcome === 'could-not-parse') {
        const partialParse = decisions.length > 0;
        output({
            passed: false,
            skipped: false,
            reason: 'could-not-parse',
            total: decisions.length,
            covered: 0,
            uncovered: [],
            message: partialParse
                ? 'Decision coverage gate: decisions could not be fully parsed — one or more ' +
                    '`- **D-NN ...**` bullets appear malformed (missing `:` or ` — ` separator). ' +
                    'Fix the bullet format so all D-NN decisions can be read before re-running the gate.'
                : 'Decision coverage gate: could not parse decisions — possible format mismatch. ' +
                    'The CONTEXT.md appears to be decision-shaped (has a <decisions> block, a decisions heading, ' +
                    'or D- tokens) but no D-NN bullets could be extracted. Check the formatting of the decisions ' +
                    'block and ensure bullets follow the `- **D-NN:** text` or `- **D-NN — title** body` form.',
        }, raw, undefined);
        return;
    }
    if (decisions.length === 0) {
        output({ passed: true, skipped: true, reason: 'no trackable decisions', total: 0, covered: 0, uncovered: [], message: 'No trackable decisions in CONTEXT.md.' }, raw, undefined);
        return;
    }
    const sections = loadPlanContents(phaseDir).map(extractPlanDesignatedSections);
    const uncovered = [];
    let covered = 0;
    for (const decision of decisions) {
        if (sections.some((section) => decisionMentioned(section, decision)))
            covered++;
        else
            uncovered.push({ id: decision.id, text: decision.text, category: decision.category });
    }
    output({
        passed: uncovered.length === 0,
        skipped: false,
        total: decisions.length,
        covered,
        uncovered,
        message: buildPlanMessage(uncovered),
    }, raw, undefined);
}
function recentCommitMessages(projectDir) {
    try {
        return (0, node_child_process_1.execFileSync)('git', ['log', '-n', '200', '--pretty=%s%n%b'], {
            cwd: projectDir,
            encoding: 'utf-8',
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true,
        });
    }
    catch {
        return '';
    }
}
function isInsideRoot(candidatePath, rootDir) {
    const root = node_path_1.default.resolve(rootDir);
    const target = node_path_1.default.resolve(root, candidatePath);
    return target === root || target.startsWith(`${root}${node_path_1.default.sep}`);
}
function readModifiedFilesContent(projectDir, summaries) {
    const out = [];
    let total = 0;
    for (const summary of summaries) {
        if (!summary)
            continue;
        for (const blockMatch of summary.matchAll(/files_modified:\s*\n((?:[ \t]*-\s+.+\n?)+)/g)) {
            const files = [...(blockMatch[1] || '').matchAll(/-\s+(.+)/g)]
                .map((match) => match[1].trim().replace(/^["']|["']$/g, ''));
            for (const file of files) {
                if (total >= 50)
                    break;
                if (!file || !isInsideRoot(file, projectDir))
                    continue;
                const raw = readIfExists(resolvePath(file, projectDir));
                out.push(raw.length > 256 * 1024 ? raw.slice(0, 256 * 1024) : raw);
                total++;
            }
            if (total >= 50)
                break;
        }
        if (total >= 50)
            break;
    }
    return out.join('\n\n');
}
function cmdDecisionCoverageVerify(projectDir, args, raw) {
    const phaseDir = args[2] ? resolvePath(args[2], projectDir) : '';
    const contextPath = args[3] ? resolvePath(args[3], projectDir) : '';
    if (!gateEnabled(projectDir)) {
        output({ skipped: true, blocking: false, reason: 'workflow.context_coverage_gate is false', total: 0, honored: 0, not_honored: [], message: 'Decision coverage gate disabled by config.' }, raw, undefined);
        return;
    }
    if (!contextPath || !node_fs_1.default.existsSync(contextPath)) {
        output({ skipped: true, blocking: false, reason: 'CONTEXT.md missing', total: 0, honored: 0, not_honored: [], message: 'No CONTEXT.md - nothing to check.' }, raw, undefined);
        return;
    }
    const { trackable: decisions, outcome: decisionOutcome } = loadDecisionExtraction(contextPath);
    // Mirror could-not-parse surface for verify (non-blocking advisory WARN).
    // Fire independent of decisions.length — a parse-miss on any bullet must surface,
    // even when some decisions were partially extracted (#1365 fix-parity with plan gate).
    if (decisionOutcome === 'could-not-parse') {
        const partialParse = decisions.length > 0;
        output({
            skipped: false,
            blocking: false,
            reason: 'could-not-parse',
            total: decisions.length,
            honored: 0,
            not_honored: [],
            message: partialParse
                ? 'Decision coverage verify (warning): decisions could not be fully parsed — one or more ' +
                    '`- **D-NN ...**` bullets appear malformed. Fix the bullet format in the CONTEXT.md decisions block.'
                : 'Decision coverage verify (warning): could not parse decisions — possible format mismatch. ' +
                    'Check the formatting of the CONTEXT.md decisions block.',
        }, raw, undefined);
        return;
    }
    if (decisions.length === 0) {
        output({ skipped: true, blocking: false, reason: 'no trackable decisions', total: 0, honored: 0, not_honored: [], message: 'No trackable decisions in CONTEXT.md.' }, raw, undefined);
        return;
    }
    const planContents = loadPlanContents(phaseDir);
    const summaryParts = node_fs_1.default.existsSync(phaseDir)
        ? node_fs_1.default.readdirSync(phaseDir).filter((entry) => /-SUMMARY\.md$/.test(entry)).map((entry) => readIfExists(node_path_1.default.join(phaseDir, entry)))
        : [];
    const haystack = [
        planContents.join('\n\n'),
        summaryParts.join('\n\n'),
        readModifiedFilesContent(projectDir, summaryParts),
        recentCommitMessages(projectDir),
    ].join('\n\n');
    const notHonored = [];
    let honored = 0;
    for (const decision of decisions) {
        if (decisionMentioned(haystack, decision))
            honored++;
        else
            notHonored.push({ id: decision.id, text: decision.text, category: decision.category });
    }
    output({
        skipped: false,
        blocking: false,
        total: decisions.length,
        honored,
        not_honored: notHonored,
        message: buildVerifyMessage(notHonored),
    }, raw, undefined);
}
// ─── ui-plan-gate ─────────────────────────────────────────────────────────────
/**
 * ui-plan-gate: given a phase number, checks whether the phase has frontend
 * indicators and whether a *-UI-SPEC.md already exists in the phase directory.
 *
 * Returns JSON: { frontend: boolean, hasUiSpec: boolean, block: boolean }
 *   block = frontend && !hasUiSpec (gate fires when UI work is detected but no spec exists)
 *
 * Invocable as: gsd_run check ui-plan-gate <phase>
 *
 * Uses checkUiPresence from ui-safety-gate.cjs — does NOT reimplement frontend detection.
 * Uses getRoadmapPhaseWithFallback + findPhaseInternal from leaf modules for phase data.
 */
function findUiSpecInDir(phaseDir) {
    if (!phaseDir || !node_fs_1.default.existsSync(phaseDir))
        return '';
    try {
        const files = node_fs_1.default.readdirSync(phaseDir);
        const found = files.find((f) => /-UI-SPEC\.md$/.test(f));
        return found ? node_path_1.default.join(phaseDir, found) : '';
    }
    catch {
        return '';
    }
}
/**
 * Pure logic for ui-plan-gate — exposed for direct behavioral testing.
 *
 * Given a projectDir and phase number:
 *   (a) Reads the phase section from ROADMAP.md via getRoadmapPhaseWithFallback —
 *       same two-pass lookup (current milestone → full roadmap) as `roadmap.get-phase`
 *       (cmdRoadmapGetPhase). Cross-milestone / older frontend phases resolve correctly.
 *       If ROADMAP.md is missing, phaseSection is '' (ROADMAP.md not present = project
 *       has no roadmap = cannot be frontend). If the phase truly can't be found after
 *       both passes, phaseSection is '' and phaseLookupFailed is set so callers can
 *       surface the miss — we do NOT silently degrade to frontend:false if the roadmap
 *       exists but the phase header is absent.
 *   (b) Runs checkUiPresence (frontend detection) — no reimplementation.
 *   (c) Resolves the phase directory via findPhaseInternal (phase-locator.cjs); checks for *-UI-SPEC.md.
 *
 * Returns: { frontend, hasUiSpec, block, uiSpecPath, phaseLookupFailed }
 *   block = frontend && !hasUiSpec
 *   phaseLookupFailed = ROADMAP.md present but phase header not found (surfaced for
 *                       onError:halt gates so a missing phase doesn't silently bypass)
 */
function computeUiPlanGate(projectDir, phase) {
    // (a) Read the phase section text using the same two-pass lookup as roadmap.get-phase.
    // getRoadmapPhaseWithFallback: current-milestone first, then stripShippedMilestones
    // fallback — mirrors cmdRoadmapGetPhase exactly.
    let phaseSection = '';
    let phaseLookupFailed;
    try {
        const section = getRoadmapPhaseWithFallback(projectDir, phase);
        if (section === null) {
            // Distinguish: ROADMAP.md missing (no-roadmap project) vs phase not found in ROADMAP.
            // planningDir(cwd) resolves the .planning/ root for workstream-aware paths.
            const planDir = planningDir(projectDir);
            const roadmapPath = node_path_1.default.join(planDir, 'ROADMAP.md');
            if (node_fs_1.default.existsSync(roadmapPath)) {
                // ROADMAP.md exists but phase was not found → surface the miss
                phaseLookupFailed = true;
            }
            // phaseSection stays ''
        }
        else {
            phaseSection = section;
        }
    }
    catch { /* roadmap read failure → treat as empty (non-frontend) */ }
    // (b) Run checkUiPresence (frontend detection) — reuse existing helper; no reimplementation
    const presenceResult = (0, ui_safety_gate_cjs_1.checkUiPresence)(phaseSection);
    const frontend = presenceResult.hasUI;
    // (c) Resolve phase directory via findPhaseInternal and check for *-UI-SPEC.md
    let phaseDir = '';
    try {
        const result = findPhaseInternal(projectDir, phase);
        if (result && typeof result === 'object') {
            // findPhaseInternal returns { directory: '<relative-posix-path>', ... }
            // directory is relative to cwd — resolve it to absolute.
            const relDir = typeof result['directory'] === 'string' ? result['directory'] : '';
            if (relDir) {
                phaseDir = node_path_1.default.resolve(projectDir, relDir);
            }
        }
        else if (typeof result === 'string') {
            phaseDir = result;
        }
    }
    catch { /* phase dir lookup failure → hasUiSpec=false */ }
    const uiSpecPath = findUiSpecInDir(phaseDir);
    const hasUiSpec = uiSpecPath !== '';
    // block = frontend phase with no UI-SPEC
    const block = frontend && !hasUiSpec;
    const result = {
        frontend, hasUiSpec, block, uiSpecPath: hasUiSpec ? uiSpecPath : null,
    };
    if (phaseLookupFailed)
        result.phaseLookupFailed = true;
    return result;
}
function cmdUiPlanGate(projectDir, args, raw) {
    // args[0] = 'check', args[1] = 'ui-plan-gate', args[2] = phase
    const phase = args[2] || '';
    if (!phase) {
        error('ui-plan-gate requires a phase argument: check ui-plan-gate <phase>', ERROR_REASON.SDK_MISSING_ARG);
        return;
    }
    output(computeUiPlanGate(projectDir, phase), raw, undefined);
}
// ─── ui-safety-gate ───────────────────────────────────────────────────────────
/**
 * ui-safety-gate: post-wave check that verifies UI-changed files conform to
 * the active UI-SPEC for the phase. Called after each wave by execute:wave:post.
 *
 * Returns JSON: { frontend: boolean, hasUiFiles: boolean, hasUiSpec: boolean, block: boolean, message?: string }
 *   block = frontend && hasUiFiles && !hasUiSpec
 *
 * Args: check ui-safety-gate <phase>
 * Invocable as: gsd_run check ui-safety-gate <phase>
 *             or gsd_run check ui.safety-gate <phase> (dots normalized to hyphens)
 *
 * Uses checkUiPresence from ui-safety-gate.cjs — does NOT reimplement frontend detection.
 * Checks whether any files changed in recent git history match frontend file patterns.
 * Also checks whether a *-UI-SPEC.md exists in the phase directory (same as ui-plan-gate).
 *
 * Limitation: uses git diff HEAD~1..HEAD which covers only the last commit; in a
 * multi-plan wave the wave-start commit would be more accurate but is not yet stored
 * in the wave manifest. This is tracked as a known limitation.
 */
const UI_FILE_EXTENSIONS_RE = /\.(tsx|jsx|css|scss|sass|less|vue|svelte|html)$/i;
const UI_PATH_PATTERNS_RE = /\/(components|pages|views|screens|layouts|ui|frontend)\//i;
/**
 * Pure logic for ui-safety-gate — exposed for direct behavioral testing.
 *
 * Given a projectDir and phase number:
 *   (a) Reads the phase section from ROADMAP.md via getRoadmapPhaseWithFallback —
 *       same lookup as computeUiPlanGate — to determine if this is a frontend phase.
 *   (b) Runs checkUiPresence (frontend detection) — no reimplementation.
 *   (c) Checks git diff HEAD~1..HEAD for UI file changes in the current worktree.
 *   (d) Resolves the phase directory via findPhaseInternal (phase-locator.cjs); checks for *-UI-SPEC.md.
 *
 * Returns: { frontend, hasUiFiles, hasUiSpec, block, message?, phaseLookupFailed? }
 *   block = frontend && hasUiFiles && !hasUiSpec
 *   phaseLookupFailed = ROADMAP.md present but phase header not found
 */
function computeUiSafetyGate(projectDir, phase) {
    // (a) Read the phase section text (same two-pass lookup as computeUiPlanGate)
    let phaseSection = '';
    let phaseLookupFailed;
    try {
        const section = getRoadmapPhaseWithFallback(projectDir, phase);
        if (section === null) {
            const planDir = planningDir(projectDir);
            const roadmapPath = node_path_1.default.join(planDir, 'ROADMAP.md');
            if (node_fs_1.default.existsSync(roadmapPath)) {
                phaseLookupFailed = true;
            }
        }
        else {
            phaseSection = section;
        }
    }
    catch { /* roadmap read failure → treat as empty (non-frontend) */ }
    // (b) Run checkUiPresence (frontend detection) — reuse existing helper; no reimplementation
    const presenceResult = (0, ui_safety_gate_cjs_1.checkUiPresence)(phaseSection);
    const frontend = presenceResult.hasUI;
    // (c) Check whether any UI files were changed in recent git commits
    // Uses git diff HEAD~1..HEAD to detect frontend file changes since last commit.
    // Known limitation: multi-plan waves may need the wave-start commit for full coverage.
    let hasUiFiles = false;
    try {
        const changed = (0, node_child_process_1.execFileSync)('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
            cwd: projectDir,
            encoding: 'utf-8',
            maxBuffer: 2 * 1024 * 1024,
            windowsHide: true,
        });
        hasUiFiles = changed.split('\n').some((f) => f.trim() && (UI_FILE_EXTENSIONS_RE.test(f) || UI_PATH_PATTERNS_RE.test(f)));
    }
    catch { /* git unavailable or no prior commit — treat as no UI files changed */ }
    // (d) Resolve phase directory and check for *-UI-SPEC.md (same as computeUiPlanGate)
    let phaseDir = '';
    try {
        const result = findPhaseInternal(projectDir, phase);
        if (result && typeof result === 'object') {
            const relDir = typeof result['directory'] === 'string' ? result['directory'] : '';
            if (relDir) {
                phaseDir = node_path_1.default.resolve(projectDir, relDir);
            }
        }
        else if (typeof result === 'string') {
            phaseDir = result;
        }
    }
    catch { /* phase dir lookup failure → hasUiSpec=false */ }
    const uiSpecPath = findUiSpecInDir(phaseDir);
    const hasUiSpec = uiSpecPath !== '';
    // block only when: this is a frontend phase AND UI files were changed AND no UI-SPEC exists
    const block = frontend && hasUiFiles && !hasUiSpec;
    const result = { frontend, hasUiFiles, hasUiSpec, block };
    if (block) {
        result.message = `UI files changed in this wave but no UI-SPEC.md exists for Phase ${phase}. ` +
            `Run /gsd:ui-phase ${phase} to generate the design contract before continuing.`;
    }
    if (phaseLookupFailed)
        result.phaseLookupFailed = true;
    return result;
}
function cmdUiSafetyGate(projectDir, args, raw) {
    // args[0] = 'check', args[1] = 'ui-safety-gate', args[2] = phase
    const phase = args[2] || '';
    if (!phase) {
        error('ui-safety-gate requires a phase argument: check ui-safety-gate <phase>', ERROR_REASON.SDK_MISSING_ARG);
        return;
    }
    output(computeUiSafetyGate(projectDir, phase), raw, undefined);
}
function cmdTddReviewCheckpoint(projectDir, args, raw) {
    // args[0] = 'check', args[1] = 'tdd-review-checkpoint' (normalized), args[2] = phase
    const phase = args[2] || '';
    if (!phase) {
        error('tdd.review-checkpoint requires a phase argument: check tdd.review-checkpoint <phase>', ERROR_REASON.SDK_MISSING_ARG);
        return;
    }
    // Resolve phase directory
    let phaseDir = '';
    try {
        const result = findPhaseInternal(projectDir, phase);
        if (result && typeof result === 'object') {
            const relDir = typeof result['directory'] === 'string' ? result['directory'] : '';
            if (relDir)
                phaseDir = node_path_1.default.resolve(projectDir, relDir);
        }
        else if (typeof result === 'string') {
            phaseDir = result;
        }
    }
    catch { /* phase dir lookup failure */ }
    // Find all PLAN.md files with type: tdd in frontmatter
    const tddPlanFiles = [];
    if (phaseDir) {
        try {
            const files = node_fs_1.default.readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md'));
            for (const file of files) {
                const planPath = node_path_1.default.join(phaseDir, file);
                const content = readIfExists(planPath);
                // Check frontmatter for type: tdd
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                    const fm = frontmatterMatch[1];
                    if (/^type:\s*tdd\s*$/m.test(fm)) {
                        tddPlanFiles.push(planPath);
                    }
                }
            }
        }
        catch { /* directory read failure */ }
    }
    if (tddPlanFiles.length === 0) {
        const result = {
            // Uniform gate contract: block = violations > 0 (advisory; never truly blocks).
            block: false,
            passed: true,
            tddPlans: 0,
            violations: 0,
            table: '',
            rows: [],
            message: `No type:tdd plans found in phase ${phase}. TDD review skipped.`,
        };
        // Pass undefined as rawValue so --raw emits JSON (not plain text).
        // The human-readable report is carried in `result.message` for the
        // dispatch's advisory branch to surface.
        output(result, raw, undefined);
        return;
    }
    // For each TDD plan, extract the plan ID (padded plan number) and check git log
    const rows = [];
    for (const planPath of tddPlanFiles) {
        // Extract plan ID from filename (e.g. "01-02-PLAN.md" → "01-02", or "03-PLAN.md" → "03")
        const basename = node_path_1.default.basename(planPath, '-PLAN.md');
        // planId for commit grep: phase-plan format, e.g. "01-02"
        const planId = basename;
        // Check for RED gate commit: test({planId}):
        let red = false;
        let green = false;
        let refactor = false;
        try {
            const redCommit = (0, node_child_process_1.execFileSync)('git', ['log', '--oneline', `--grep=^test(${planId}):`, '--', '.'], { cwd: projectDir, encoding: 'utf-8', maxBuffer: 1024 * 1024, windowsHide: true });
            red = redCommit.trim().length > 0;
        }
        catch { /* git unavailable or no match */ }
        try {
            const greenCommit = (0, node_child_process_1.execFileSync)('git', ['log', '--oneline', `--grep=^feat(${planId}):`, '--', '.'], { cwd: projectDir, encoding: 'utf-8', maxBuffer: 1024 * 1024, windowsHide: true });
            green = greenCommit.trim().length > 0;
        }
        catch { /* git unavailable or no match */ }
        try {
            const refactorCommit = (0, node_child_process_1.execFileSync)('git', ['log', '--oneline', `--grep=^refactor(${planId}):`, '--', '.'], { cwd: projectDir, encoding: 'utf-8', maxBuffer: 1024 * 1024, windowsHide: true });
            refactor = refactorCommit.trim().length > 0;
        }
        catch { /* git unavailable or no match */ }
        const missing = [];
        if (!red)
            missing.push('RED');
        if (!green)
            missing.push('GREEN');
        const status = missing.length === 0 ? 'Pass' : 'FAIL';
        rows.push({ planId, red, green, refactor, status, missing });
    }
    const violations = rows.filter(r => r.status === 'FAIL').length;
    // Build review table
    const sep = '━'.repeat(53);
    const tableHeader = '| Plan | RED | GREEN | REFACTOR | Status |';
    const tableDivider = '|------|-----|-------|----------|--------|';
    const tableRows = rows.map(r => `| ${r.planId.padEnd(4)} | ${r.red ? ' ✓ ' : ' ✗ '} | ${r.green ? '  ✓  ' : '  ✗  '} | ${r.refactor ? '   ✓    ' : '   —    '} | ${r.status.padEnd(6)} |`);
    let table = [
        sep,
        ` TDD REVIEW — Phase ${phase}`,
        sep,
        '',
        `TDD Plans: ${tddPlanFiles.length} | Gate violations: ${violations}`,
        '',
        tableHeader,
        tableDivider,
        ...tableRows,
    ].join('\n');
    if (violations > 0) {
        table += '\n\n⚠ Gate violations are advisory — review before advancing.';
        for (const r of rows.filter(row => row.status === 'FAIL')) {
            table += `\n  Plan ${r.planId} missing: ${r.missing.join(', ')} gate commit(s).`;
            table += `\n  Expected commit pattern: test(${r.planId}): ... → feat(${r.planId}): ...`;
        }
    }
    const result = {
        // Uniform gate contract: block = violations > 0.
        // This gate is advisory (blocking: false in capability.json) so block:true
        // only surfaces as a warning, never halts. Kept here so the host-loop
        // dispatch can read a single consistent `block` field.
        block: violations > 0,
        passed: true,
        tddPlans: tddPlanFiles.length,
        violations,
        table,
        rows,
        // Human-readable report in `message` so the dispatch's advisory branch
        // can surface it. --raw emits JSON (rawValue=undefined), not plain text.
        message: table,
    };
    // Pass undefined as rawValue so --raw emits JSON (not the raw table text).
    // The review table is carried in `result.message` and `result.table` so
    // the host-loop dispatch's advisory branch can surface it.
    output(result, raw, undefined);
}
// ─── gap-analysis-plan-post ───────────────────────────────────────────────────
/**
 * gap-analysis-plan-post: non-blocking advisory check that runs the post-planning
 * gap analysis after all PLAN.md files are generated for a phase.
 *
 * Cross-references every REQ-ID and D-ID from REQUIREMENTS.md and CONTEXT.md
 * against the concatenated text of all *-PLAN.md files, emitting a coverage table.
 *
 * This gate is always advisory (passed: true) — it never blocks phase advancement.
 *
 * Args: check gap-analysis.plan-post <phase-dir> [phase-req-ids]
 * Invocable as: gsd_run check gap-analysis.plan-post <phase-dir> [phase-req-ids]
 */
function cmdGapAnalysisPlanPost(projectDir, args, raw) {
    // args[0] = 'check', args[1] = 'gap-analysis-plan-post' (normalized), args[2] = phaseDir, args[3] = phaseReqIds
    const phaseDir = args[2] || '';
    if (!phaseDir) {
        error('gap-analysis.plan-post requires a phase-dir argument: check gap-analysis.plan-post <phase-dir> [phase-req-ids]', ERROR_REASON.SDK_MISSING_ARG);
        return;
    }
    const phaseReqIds = args[3] ?? undefined;
    const result = runGapAnalysis(projectDir, phaseDir, { phaseReqIds });
    // Uniform gate contract: block = false (gap-analysis is always advisory, never blocks).
    // `message` carries the human-readable gap analysis report so the dispatch's
    // advisory branch can surface it. --raw emits JSON (rawValue=undefined), not
    // plain markdown text.
    output({
        block: false,
        passed: true,
        enabled: result.enabled,
        table: result.table,
        summary: result.summary,
        counts: result.counts,
        // Human-readable report in `message` for the host-loop advisory branch.
        message: result.table || result.summary || '',
    }, raw, undefined);
}
function routeCheckCommand({ args, cwd, raw }) {
    // Normalize dots to hyphens in the subcommand so both forms are accepted.
    // This makes `check.query = "ui.plan-gate"` (dotted form in capability.json gates)
    // directly runnable as `gsd_run check ui.plan-gate` — the dot is normalized to
    // `ui-plan-gate` before routing. The generic gate-dispatch in §5.6 reads
    // `check.query` from the active gate hook and runs `gsd_run check ${hook.check.query}`,
    // so the declared query must be dispatchable exactly as declared.
    const rawSubcommand = args[1];
    const subcommand = typeof rawSubcommand === 'string' ? rawSubcommand.replace(/\./g, '-') : rawSubcommand;
    if (subcommand === 'auto-mode') {
        cmdAutoMode(cwd, raw);
        return;
    }
    if (subcommand === 'decision-coverage-plan') {
        cmdDecisionCoveragePlan(cwd, args, raw);
        return;
    }
    if (subcommand === 'decision-coverage-verify') {
        cmdDecisionCoverageVerify(cwd, args, raw);
        return;
    }
    if (subcommand === 'ui-plan-gate') {
        cmdUiPlanGate(cwd, args, raw);
        return;
    }
    if (subcommand === 'gap-analysis-plan-post') {
        cmdGapAnalysisPlanPost(cwd, args, raw);
        return;
    }
    if (subcommand === 'tdd-review-checkpoint') {
        cmdTddReviewCheckpoint(cwd, args, raw);
        return;
    }
    if (subcommand === 'ui-safety-gate') {
        cmdUiSafetyGate(cwd, args, raw);
        return;
    }
    if (subcommand === 'verify-schema-drift') {
        // Delegates to verify.schema-drift — drift capability gate at execute:wave:post (blocking).
        // Dot-to-hyphen normalization means query "verify.schema-drift" routes here.
        // Honor GSD_SKIP_SCHEMA_CHECK=true to bypass the gate (preserves the original inline gate behavior).
        const phaseArg = typeof args[2] === 'string' ? args[2] : '';
        const skipSchemaCheck = process.env['GSD_SKIP_SCHEMA_CHECK'] === 'true';
        cmdVerifySchemaDrift(cwd, phaseArg, skipSchemaCheck, raw);
        return;
    }
    if (subcommand === 'verify-codebase-drift') {
        // Delegates to verify.codebase-drift — drift capability gate at execute:wave:post (non-blocking).
        // Dot-to-hyphen normalization means query "verify.codebase-drift" routes here.
        cmdVerifyCodebaseDrift(cwd, raw);
        return;
    }
    if (subcommand === 'prohibition-enforcement') {
        // The deterministic test-tier prohibition PRODUCER/gate (#1259, ADR-550 D5d). Locates the
        // wired mechanical check (node-test or lint-rule), confirms fail-first, runs it, builds
        // enforcementEvidence, and emits the dispositionForProhibition verdict. Invocable as
        // `gsd_run check prohibition-enforcement <request.json>`.
        (0, prohibition_enforcement_cjs_1.routeProhibitionEnforcement)(args, raw);
        return;
    }
    error('Unknown check subcommand. Available: auto-mode, decision-coverage-plan, decision-coverage-verify, gap-analysis-plan-post, prohibition-enforcement, tdd-review-checkpoint, ui-plan-gate, ui-safety-gate, verify-schema-drift, verify-codebase-drift', ERROR_REASON.SDK_UNKNOWN_COMMAND);
}
module.exports = {
    routeCheckCommand,
    decisionMentioned,
    extractPlanDesignatedSections,
    computeUiPlanGate,
    computeUiSafetyGate,
    cmdGapAnalysisPlanPost,
    cmdTddReviewCheckpoint,
};

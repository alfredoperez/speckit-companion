"use strict";
/**
 * UAT Audit — Cross-phase UAT/VERIFICATION scanner
 *
 * Reads all *-UAT.md and *-VERIFICATION.md files across all phases.
 * Extracts non-passing items. Returns structured JSON for workflow consumption.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/uat.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only strict types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const io = require("./io.cjs");
const { output, error } = io;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const markdownSectionizer = require("./markdown-sectionizer.cjs");
const { collectSection, tokenizeHeadings } = markdownSectionizer;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const roadmapParser = require("./roadmap-parser.cjs");
const { getMilestonePhaseFilter } = roadmapParser;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coreUtils = require("./core-utils.cjs");
const { toPosixPath } = coreUtils;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspace = require("./planning-workspace.cjs");
const { planningDir } = planningWorkspace;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const frontmatter = require("./frontmatter.cjs");
const { extractFrontmatter } = frontmatter;
const security_cjs_1 = require("./security.cjs");
// ─── cmdAuditUat ─────────────────────────────────────────────────────────────
function cmdAuditUat(cwd, raw) {
    const phasesDir = node_path_1.default.join(planningDir(cwd), 'phases');
    if (!node_fs_1.default.existsSync(phasesDir)) {
        error('No phases directory found in planning directory');
    }
    const isDirInMilestone = getMilestonePhaseFilter(cwd);
    const results = [];
    // Scan all phase directories
    const dirs = node_fs_1.default.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .filter(isDirInMilestone)
        .sort();
    for (const dir of dirs) {
        const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
        const phaseNum = phaseMatch ? phaseMatch[1] : dir;
        const phaseDir = node_path_1.default.join(phasesDir, dir);
        const files = node_fs_1.default.readdirSync(phaseDir);
        // Process UAT files
        for (const file of files.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
            const content = node_fs_1.default.readFileSync(node_path_1.default.join(phaseDir, file), 'utf-8');
            const items = parseUatItems(content);
            if (items.length > 0) {
                results.push({
                    phase: phaseNum,
                    phase_dir: dir,
                    file,
                    file_path: toPosixPath(node_path_1.default.relative(cwd, node_path_1.default.join(phaseDir, file))),
                    type: 'uat',
                    status: (extractFrontmatter(content).status || 'unknown'),
                    items,
                });
            }
        }
        // Process VERIFICATION files
        for (const file of files.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
            const content = node_fs_1.default.readFileSync(node_path_1.default.join(phaseDir, file), 'utf-8');
            const status = extractFrontmatter(content).status || 'unknown';
            if (status === 'human_needed' || status === 'gaps_found') {
                const items = parseVerificationItems(content, status);
                if (items.length > 0) {
                    results.push({
                        phase: phaseNum,
                        phase_dir: dir,
                        file,
                        file_path: toPosixPath(node_path_1.default.relative(cwd, node_path_1.default.join(phaseDir, file))),
                        type: 'verification',
                        status,
                        items,
                    });
                }
            }
        }
    }
    // Compute summary
    const summary = {
        total_files: results.length,
        total_items: results.reduce((sum, r) => sum + r.items.length, 0),
        by_category: {},
        by_phase: {},
    };
    for (const r of results) {
        if (!summary.by_phase[r.phase])
            summary.by_phase[r.phase] = 0;
        for (const item of r.items) {
            summary.by_phase[r.phase]++;
            const cat = item.category || 'unknown';
            summary.by_category[cat] = (summary.by_category[cat] || 0) + 1;
        }
    }
    output({ results, summary }, raw, undefined);
}
// ─── cmdRenderCheckpoint ──────────────────────────────────────────────────────
function cmdRenderCheckpoint(cwd, options = {}, raw) {
    const filePath = options.file;
    if (!filePath) {
        error('UAT file required: use uat render-checkpoint --file <path>');
    }
    const resolvedPath = (0, security_cjs_1.requireSafePath)(filePath, cwd, 'UAT file', { allowAbsolute: true });
    if (!node_fs_1.default.existsSync(resolvedPath)) {
        error(`UAT file not found: ${filePath}`);
    }
    const content = node_fs_1.default.readFileSync(resolvedPath, 'utf-8');
    const currentTest = parseCurrentTest(content);
    if (currentTest.complete) {
        error('UAT session is already complete; no pending checkpoint to render');
    }
    const checkpoint = buildCheckpoint(currentTest);
    output({
        file_path: toPosixPath(node_path_1.default.relative(cwd, resolvedPath)),
        test_number: currentTest.number,
        test_name: currentTest.name,
        checkpoint,
    }, raw, checkpoint);
}
// ─── parseCurrentTest ─────────────────────────────────────────────────────────
function parseCurrentTest(content) {
    // Use the seam to locate the ## Current Test section (ADR-1372 T5).
    // HTML-comment stripping within the section body is UAT-specific, so we keep
    // the comment removal caller-side after extracting the body.
    const currentTestSection = collectSection(content, (h) => /^current\s+test$/i.test(h.text) && h.level === 2, { levelBounded: true });
    if (!currentTestSection) {
        error('UAT file is missing a Current Test section');
    }
    // Remove any leading HTML comment block (UAT-specific document structure)
    const rawBody = currentTestSection.body.replace(/^<!--[\s\S]*?-->\s*\n?/, '');
    const section = rawBody.trimEnd();
    if (!section.trim()) {
        error('Current Test section is empty');
    }
    if (/\[testing complete\]/i.test(section)) {
        return { complete: true };
    }
    const numberMatch = section.match(/^number:\s*(\d+)\s*$/m);
    const nameMatch = section.match(/^name:\s*(.+)\s*$/m);
    const expectedBlockMatch = section.match(/^expected:\s*\|\n([\s\S]*?)(?=^\w[\w-]*:\s)/m)
        || section.match(/^expected:\s*\|\n([\s\S]+)/m);
    const expectedInlineMatch = section.match(/^expected:\s*(.+)\s*$/m);
    if (!numberMatch || !nameMatch || (!expectedBlockMatch && !expectedInlineMatch)) {
        if (!numberMatch && !nameMatch && !expectedBlockMatch && !expectedInlineMatch) {
            const pendingTest = parseFirstPendingTest(content);
            if (pendingTest) {
                return pendingTest;
            }
            error('Current Test section is non-structured and no pending UAT test remains to resume');
        }
        error('Current Test section is malformed');
    }
    let expected;
    if (expectedBlockMatch) {
        expected = expectedBlockMatch[1]
            .split('\n')
            .map((line) => line.replace(/^ {2}/, ''))
            .join('\n')
            .trim();
    }
    else {
        expected = expectedInlineMatch[1].trim();
    }
    return {
        complete: false,
        number: parseInt(numberMatch[1], 10),
        name: (0, security_cjs_1.sanitizeForDisplay)(nameMatch[1].trim()),
        expected: (0, security_cjs_1.sanitizeForDisplay)(expected),
    };
}
function parseFirstPendingTest(content) {
    // Use the seam to locate the ## Tests section (ADR-1372 T5).
    const testsSection = collectSection(content, (h) => /^tests$/i.test(h.text) && h.level === 2, { levelBounded: true });
    if (!testsSection) {
        return null;
    }
    const sectionBody = testsSection.body;
    // Within the Tests section body, find ### N. Name sub-headings.
    // tokenizeHeadings operates on the section body as a standalone document,
    // filtering to level-3 headings matching the UAT-specific "N. Name" pattern.
    // The UAT-specific item parsing (number extraction, result parsing) stays caller-side.
    const subHeadings = tokenizeHeadings(sectionBody).filter((h) => h.level === 3 && /^\d+\.\s+/.test(h.text));
    for (let i = 0; i < subHeadings.length; i += 1) {
        const current = subHeadings[i];
        const next = subHeadings[i + 1];
        // Slice the block for this sub-test from the section body text
        const block = next
            ? sectionBody.slice(current.offset, next.offset)
            : sectionBody.slice(current.offset);
        if (!/^result:\s*\[?pending\]?\s*$/im.test(block)) {
            continue;
        }
        // Extract the UAT-specific number and name from the heading text
        const headingParts = current.text.match(/^(\d+)\.\s+(.+)$/);
        if (!headingParts)
            continue;
        const testNumber = parseInt(headingParts[1], 10);
        const testName = headingParts[2].trim();
        const expected = parseExpectedFromTestBlock(block);
        if (!expected) {
            error(`Pending UAT test ${testNumber} is missing an expected field`);
        }
        return {
            complete: false,
            number: testNumber,
            name: (0, security_cjs_1.sanitizeForDisplay)(testName),
            expected: (0, security_cjs_1.sanitizeForDisplay)(expected),
        };
    }
    return null;
}
function parseExpectedFromTestBlock(block) {
    const expectedBlockMatch = block.match(/^expected:\s*\|\n([\s\S]*?)(?=^\w[\w-]*:\s)/m)
        || block.match(/^expected:\s*\|\n([\s\S]+)/m);
    if (expectedBlockMatch) {
        return expectedBlockMatch[1]
            .split('\n')
            .map((line) => line.replace(/^ {2}/, ''))
            .join('\n')
            .trim();
    }
    const expectedInlineMatch = block.match(/^expected:\s*(.+)\s*$/m);
    return expectedInlineMatch ? expectedInlineMatch[1].trim() : null;
}
// ─── buildCheckpoint ──────────────────────────────────────────────────────────
function buildCheckpoint(currentTest) {
    return [
        '╔══════════════════════════════════════════════════════════════╗',
        '║  CHECKPOINT: Verification Required                           ║',
        '╚══════════════════════════════════════════════════════════════╝',
        '',
        `**Test ${currentTest.number}: ${currentTest.name}**`,
        '',
        currentTest.expected,
        '',
        '──────────────────────────────────────────────────────────────',
        'Type `pass` or describe what\'s wrong.',
        '──────────────────────────────────────────────────────────────',
    ].join('\n');
}
// ─── parseUatItems ────────────────────────────────────────────────────────────
function parseUatItems(content) {
    const items = [];
    // Match test blocks: ### N. Name\nexpected: ...\nresult: ...\n
    // Accept both bare (result: pending) and bracketed (result: [pending]) formats (#2273)
    const testPattern = /###\s*(\d+)\.\s*([^\n]+)\nexpected:\s*([^\n]+)\nresult:\s*\[?(\w+)\]?(?:\n(?:reported|reason|blocked_by):\s*[^\n]*)?/g;
    let match;
    while ((match = testPattern.exec(content)) !== null) {
        const [, num, name, expected, result] = match;
        if (result === 'pending' || result === 'skipped' || result === 'blocked') {
            // Extract optional fields — limit to current test block (up to next ### or EOF)
            const afterMatch = content.slice(match.index);
            const nextHeading = afterMatch.indexOf('\n###', 1);
            const blockText = nextHeading > 0 ? afterMatch.slice(0, nextHeading) : afterMatch;
            const reasonMatch = blockText.match(/reason:\s*(.+)/);
            const blockedByMatch = blockText.match(/blocked_by:\s*(.+)/);
            const item = {
                test: parseInt(num, 10),
                name: name.trim(),
                expected: expected.trim(),
                result,
                category: categorizeItem(result, reasonMatch?.[1], blockedByMatch?.[1]),
            };
            if (reasonMatch)
                item.reason = reasonMatch[1].trim();
            if (blockedByMatch)
                item.blocked_by = blockedByMatch[1].trim();
            items.push(item);
        }
    }
    return items;
}
// ─── parseVerificationItems ───────────────────────────────────────────────────
function parseVerificationItems(content, status) {
    const items = [];
    if (status === 'human_needed') {
        // Use the seam to locate the ## Human Verification section (ADR-1372 T5).
        const hvSection = collectSection(content, (h) => /^human\s+verification/i.test(h.text) && h.level === 2, { levelBounded: true });
        if (hvSection) {
            const lines = hvSection.body.split('\n');
            for (const line of lines) {
                // Match table rows: | N | description | ... |
                const tableMatch = line.match(/\|\s*(\d+)\s*\|\s*([^|]+)/);
                // Match bullet items: - description
                const bulletMatch = line.match(/^[-*]\s+(.+)/);
                // Match numbered items: 1. description
                const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
                if (tableMatch) {
                    // Skip rows that already have a passing result (PASS, pass, resolved, etc.)
                    const rowRemainder = line.slice(tableMatch.index + tableMatch[0].length);
                    const cellValues = rowRemainder.split('|').map(c => c.trim());
                    const hasPassResult = cellValues.some(c => /^pass$/i.test(c) || /^resolved$/i.test(c));
                    if (hasPassResult)
                        continue;
                    items.push({
                        test: parseInt(tableMatch[1], 10),
                        name: tableMatch[2].trim(),
                        result: 'human_needed',
                        category: 'human_uat',
                    });
                }
                else if (numberedMatch) {
                    items.push({
                        test: parseInt(numberedMatch[1], 10),
                        name: numberedMatch[2].trim(),
                        result: 'human_needed',
                        category: 'human_uat',
                    });
                }
                else if (bulletMatch && bulletMatch[1].length > 10) {
                    items.push({
                        name: bulletMatch[1].trim(),
                        result: 'human_needed',
                        category: 'human_uat',
                    });
                }
            }
        }
    }
    // gaps_found items are already handled by plan-phase --gaps pipeline
    return items;
}
// ─── categorizeItem ───────────────────────────────────────────────────────────
function categorizeItem(result, reason, blockedBy) {
    if (result === 'blocked' || blockedBy) {
        if (blockedBy) {
            if (/server/i.test(blockedBy))
                return 'server_blocked';
            if (/device|physical/i.test(blockedBy))
                return 'device_needed';
            if (/build|release|preview/i.test(blockedBy))
                return 'build_needed';
            if (/third.party|twilio|stripe/i.test(blockedBy))
                return 'third_party';
        }
        return 'blocked';
    }
    if (result === 'skipped') {
        if (reason) {
            if (/server|not running|not available/i.test(reason))
                return 'server_blocked';
            if (/simulator|physical|device/i.test(reason))
                return 'device_needed';
            if (/build|release|preview/i.test(reason))
                return 'build_needed';
        }
        return 'skipped_unresolved';
    }
    if (result === 'pending')
        return 'pending';
    if (result === 'human_needed')
        return 'human_uat';
    return 'unknown';
}
module.exports = {
    cmdAuditUat,
    cmdRenderCheckpoint,
    parseCurrentTest,
    buildCheckpoint,
};

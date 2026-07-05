#!/usr/bin/env node
// Forced-preamble sandbox eval for stock-mode capture (#408).
//
// Proves that an AI following the EXACT preamble a GUI dispatch prepends to a
// stock /speckit.* run — in a workspace with NO companion spec-kit extension —
// produces a `.spec-context.json` the Activity panel can render: status
// advanced, ICE fields, titled requirements, journaled tasks, verified checks.
//
// The preamble is composed from the compiled builders (the real text, stock
// branch), with the writer path pointed at this repo's script — exactly what
// the extension does with its bundled copy. The AI CLI runs headless in a
// throwaway sandbox; assert_capture.py grades the result.
//
// Usage: node tests/eval/stock-capture/run.mjs [--keep]
// Prereqs: npm run compile (dist/), python3, claude CLI on PATH.

import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const keep = process.argv.includes('--keep');

// ── 1. Compose the real stock preamble from the compiled module ────────────
const preambleModulePath = join(repoRoot, 'dist', 'ai-providers', 'promptPreamble.js');
if (!existsSync(preambleModulePath)) {
    console.error(`Compiled output missing: ${preambleModulePath} — run \`npm run compile\` first.`);
    process.exit(2);
}
const { renderSpecifyCreationLifecyclePreamble } = await import(preambleModulePath);

const writerPath = join(repoRoot, 'speckit-extension', 'scripts', 'write-context.py');
const specDir = 'specs/001-notes-tag';
const dispatchUtc = new Date().toISOString();
// companionInstalled=false → the stock branch, exactly as the GUI builds it
// for a create-dispatch in a companion-free workspace.
const preamble = renderSpecifyCreationLifecyclePreamble('speckit', specDir, dispatchUtc, false, writerPath);

// ── 2. Scaffold the companion-free sandbox ──────────────────────────────────
const sandbox = mkdtempSync(join(tmpdir(), 'stock-capture-eval-'));
mkdirSync(join(sandbox, 'specs'), { recursive: true });
mkdirSync(join(sandbox, '.specify'), { recursive: true }); // stock marker; NO extensions/companion
execSync('git init -q', { cwd: sandbox });
console.log(`sandbox: ${sandbox}`);

// ── 3. The stand-in for the stock command body: a tiny 2-FR feature ────────
const instruction = [
    'You are running a stock SpecKit specify+plan+tasks+implement pipeline for a tiny feature, end to end, in this workspace.',
    '',
    `Feature: add a "tag" field to notes. Work in ${specDir}/.`,
    `1. specify: write ${specDir}/spec.md with exactly two functional requirements (FR-001: a note can carry one tag; FR-002: notes can be filtered by tag).`,
    `2. plan: write a 3-sentence ${specDir}/plan.md.`,
    `3. tasks: write ${specDir}/tasks.md with two tasks (T001 add the field · notes.js, T002 add the filter · filter.js).`,
    '4. implement: create those two small JS files with plausible content, checking off each task as you finish it.',
    '',
    'Follow the context-update instructions above exactly throughout. Keep all file contents minimal — the files are not the point of this run.',
].join('\n');

const prompt = `${preamble}\n\n${instruction}`;
writeFileSync(join(sandbox, '.eval-prompt.txt'), prompt);

// ── 4. Drive the headless AI CLI in the sandbox ────────────────────────────
console.log('running headless AI (this takes a few minutes)…');
try {
    const out = execFileSync(
        'claude',
        [
            '-p', prompt,
            '--permission-mode', 'acceptEdits',
            // acceptEdits auto-allows file edits but auto-DENIES Bash in -p mode;
            // the writer/date/git calls the preamble instructs must be allowed or
            // the model degrades to hand-editing (first eval run proved exactly that).
            '--allowedTools', 'Bash(python3:*)', 'Bash(date:*)', 'Bash(git:*)', 'Bash(node:*)',
            '--max-turns', '80',
        ],
        { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 15 * 60 * 1000 }
    );
    writeFileSync(join(sandbox, '.eval-transcript.txt'), out);
    console.log('AI run finished; transcript at .eval-transcript.txt');
} catch (err) {
    console.error(`AI run failed: ${err.message}`);
    console.error(`sandbox kept for inspection: ${sandbox}`);
    process.exit(1);
}

// ── 5. Assert the produced context file ─────────────────────────────────────
const asserter = join(repoRoot, 'tests', 'eval', 'stock-capture', 'assert_capture.py');
let exitCode = 0;
try {
    execFileSync('python3', [asserter, join(sandbox, specDir)], { stdio: 'inherit' });
} catch {
    exitCode = 1;
}

if (keep || exitCode !== 0) {
    console.log(`sandbox kept: ${sandbox}`);
} else {
    rmSync(sandbox, { recursive: true, force: true });
}
process.exit(exitCode);

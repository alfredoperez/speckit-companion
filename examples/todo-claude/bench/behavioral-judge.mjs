// bench/behavioral-judge.mjs — the light behavioral oracle.
//
// Grades "does the feature actually work" from the spec's own acceptance
// scenarios + the built app source — NOT from exact data-testids and NOT from
// architecture. The bench prompts no longer leak testids (a prompt that spells
// out `data-testid="…"` was hinting the model and made the testid suite
// unwinnable when the app's own convention is role/text queries). So the
// deterministic testid suite under bench/acceptance/ is kept only as a labeled
// baseline; this judge is the primary correctness signal.
//
// It hands the scenarios + changed source to an LLM judge command and parses a
// per-scenario pass/fail verdict. The command is configurable via
// BENCH_JUDGE_CMD (default: `claude -p`); the prompt is fed on stdin and the
// judge must reply with a single JSON object. No command, no scenarios, or an
// unparseable reply → returns null, and the caller falls back to the
// deterministic baseline (nothing breaks when no judge is wired).

import { execSync } from 'node:child_process'

// Cap evidence so the judge prompt stays light — a handful of changed files is
// plenty to decide whether the scenarios' behavior is present.
const MAX_FILES = 14
const MAX_FILE_CHARS = 6000

// Pull the acceptance scenarios out of spec.md. Matches the canonical
// `**Given** … **When** … **Then** …` lines (numbered or bulleted) anywhere in
// the spec, which is where "does it work" lives. Returns [{ n, text }].
export function extractAcceptanceScenarios(specMd) {
  if (!specMd) return []
  const out = []
  for (const raw of specMd.split('\n')) {
    const line = raw.trim()
    // A scenario line mentions Given and Then (When is usually present too);
    // tolerate bold/plain and a leading list marker.
    if (/\bGiven\b/i.test(line) && /\bThen\b/i.test(line)) {
      const text = line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim()
      if (text) out.push({ n: out.length + 1, text })
    }
  }
  return out
}

// The changed source the judge looks at, capped and trimmed.
export function gatherEvidence(changed) {
  return (changed || [])
    .filter((c) => c.status !== 'deleted')
    .slice(0, MAX_FILES)
    .map((c) => ({ path: c.path, content: (c.content || '').slice(0, MAX_FILE_CHARS) }))
}

export function buildJudgePrompt(scenarios, evidence, buildPass) {
  const scenarioList = scenarios.map((s) => `${s.n}. ${s.text}`).join('\n')
  const files = evidence
    .map((e) => `\n=== ${e.path} ===\n${e.content}`)
    .join('\n')
  return `You are a strict but fair behavioral judge for a small React + TypeScript todo app.

Decide, for each acceptance scenario below, whether the CHANGED SOURCE would make that user-visible behavior work. Judge BEHAVIOR ONLY:
- Do NOT care about architecture, file layout, naming, or which patterns were used.
- Do NOT require any specific data-testid, class name, or DOM structure — a behavior counts as working no matter how it is wired, as long as a user would observe it.
- A scenario PASSES if the code present plausibly produces the Given/When/Then outcome for a user. It FAILS only if the behavior is clearly absent or broken.

Build ${buildPass ? 'PASSED' : 'FAILED'} (a failed build makes runtime behavior doubtful, but still judge each scenario on the code).

ACCEPTANCE SCENARIOS:
${scenarioList}

CHANGED SOURCE:${files}

Reply with ONE JSON object and nothing else, in exactly this shape:
{"verdicts":[{"n":1,"pass":true,"reason":"<≤12 words>"}]}
Include one entry per scenario number above.`
}

// Extract the first balanced {...} JSON object from an LLM reply.
export function parseVerdict(stdout) {
  if (!stdout) return null
  const ok = (obj) => (obj && Array.isArray(obj.verdicts) ? obj : null)
  // Fast path: the judge is told to reply with ONE JSON object and nothing else,
  // so a clean reply parses directly — this also handles braces inside reason
  // strings, which the brace-scanner below cannot.
  try {
    const obj = ok(JSON.parse(stdout.trim()))
    if (obj) return obj
  } catch { /* fall back to extraction when there's surrounding prose */ }
  // Fallback: extract the first balanced {...} object (string-aware, so a `}`
  // inside a reason string doesn't close the object early).
  const start = stdout.indexOf('{')
  if (start === -1) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < stdout.length; i++) {
    const c = stdout[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        return ok(JSON.parse(stdout.slice(start, i + 1)))
      } catch { return null }
    }
  }
  return null
}

// Primary entry point. Returns { passed, total, verdicts, source:'behavioral' }
// or null (no scenarios / no judge command / unparseable reply → caller keeps
// the deterministic baseline).
export function judgeBehavior({ specMd, changed, buildPass, judgeCmd = process.env.BENCH_JUDGE_CMD || 'claude -p' }) {
  const scenarios = extractAcceptanceScenarios(specMd)
  if (!scenarios.length || !judgeCmd) return null
  const prompt = buildJudgePrompt(scenarios, gatherEvidence(changed), buildPass)
  let stdout
  try {
    stdout = execSync(judgeCmd, { input: prompt, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'ignore'] })
  } catch {
    return null // judge CLI absent or errored → deterministic baseline
  }
  const obj = parseVerdict(stdout)
  if (!obj) return null
  const verdicts = obj.verdicts.slice(0, scenarios.length)
  const passed = verdicts.filter((v) => v && v.pass === true).length
  return { passed, total: scenarios.length, verdicts, source: 'behavioral' }
}

export const meta = {
  name: 'wave-bench',
  description: 'Bench one pipeline wave on the two Companion cells: drive, measure, judge, record',
  whenToUse: 'After the cells are baked and prepped for a wave. args: { wave, size, letters, sweep }',
  phases: [
    { title: 'Build', detail: 'One driver per cell, told a letter and nothing else' },
    { title: 'Measure', detail: 'Tokens from the transcripts, then capture with nothing else running' },
    { title: 'Judge', detail: 'A rubric per cell and one comparative review' },
    { title: 'Record', detail: 'Fold the rubric in, compare against earlier sweeps, commit the round' },
  ],
}

const { wave, size = 'hard', letters, sweep } = args
if (!wave || !letters?.length || !sweep) throw new Error('args: { wave, size, letters, sweep }')

const BENCH = '~/dev/GitHub/speckit-bench'
const CELLS_DIR = '~/dev/projects'
const cellOf = (l) => `conduit-${size}-${l}`
const dirOf = (l) => `${CELLS_DIR}/${cellOf(l)}`
const marker = (l) => `process.env.HOME+'/dev/GitHub/speckit-bench/runs-meta/${cellOf(l)}.json'`

const DRIVE_SCHEMA = {
  type: 'object',
  properties: {
    cell: { type: 'string' },
    startedAt: { type: 'string' },
    finishedAt: { type: 'string' },
    finalStatus: { type: 'string' },
    suiteGreen: { type: 'boolean' },
    notes: { type: 'string', description: 'Anything in the command bodies that did not work as written' },
  },
  required: ['cell', 'startedAt', 'finishedAt', 'finalStatus', 'suiteGreen', 'notes'],
}

function drive(letter) {
  const dir = dirOf(letter)
  return `You are building one feature in a React codebase. Work ONLY inside ${dir}. Treat it as an ordinary project you have been asked to ship a feature in.

Read ${dir}/CLAUDE.md first and follow its conventions exactly. It is a Feature-Sliced Design codebase and the layering rules in it are load-bearing.

## Before you start

Stamp the start time into the run marker (NOT into the project):

\`\`\`bash
node -e "const f=${marker(letter)};const fs=require('fs');const j=JSON.parse(fs.readFileSync(f,'utf8'));j.startedAt=new Date().toISOString();fs.writeFileSync(f,JSON.stringify(j,null,2))"
\`\`\`

## The work

Run the full spec-driven pipeline in that project: specify, then plan, then tasks, then implement. Use the \`/speckit.companion.*\` family of command bodies. Read them from \`${dir}/.claude/\` and **follow each one exactly as written**. The bodies change between rounds; do what they say now, not what you remember them saying. They carry every capture call the run needs. Add none of your own.

Before dispatching EACH step, build the same per-step preamble the GUI would prepend and treat it as part of that step's instructions:

\`\`\`bash
cd ${BENCH} && node -e "
import('./driver.mjs').then(async m => {
  console.log(await m.buildStepPreamble('<step>', '<specDir relative to the project>', new Date().toISOString(), true))
})"
\`\`\`

A step may settle past itself: the fast path can fold specify/plan/tasks onto \`ready-to-implement\`. A folded step is already done; do not re-dispatch it.

The feature to build is in \`${BENCH}/prompts/conduit/${size}.md\`, between the \`---\` rules. Read it once and build exactly that, as a person would have asked for it.

## Verifying your work

**Run the project's own build and test suite, and fix what you break.** \`yarn test --coverage=false\` and \`yarn build:prod\` are yours to use, as often as you like. Shipping a red suite counts against the work.

## Hard rules

- **No git commands at all.** Branching and committing belong to the pipeline.
- Do not create, read or write anything outside ${dir}, except the run marker, the prompt file and the preamble command above.
- Do not look for, guess at, or reason about how your work will be scored.

## When you are done

Stamp the finish time the same way (\`j.finishedAt\`), then report: your cell name (${cellOf(letter)}), startedAt, finishedAt, the final status the pipeline reached, whether the suite was green, and anything in the command bodies that did not work as written. That last item is read carefully; be specific.`
}

const drives = await parallel(
  letters.map((l) => () =>
    agent(drive(l), { label: `cell:${size}-${l}`, phase: 'Build', schema: DRIVE_SCHEMA })
      .then((r) => r && { ...r, cell: cellOf(l) })
  )
)
const built = drives.filter(Boolean)
log(`${built.length}/${letters.length} cells built`)
if (!built.length) return { wave, sweep, error: 'no cell finished' }

const measured = await agent(
  `Measure the round that just ran. Two commands, in this order, nothing else running on the machine.

1. Fold each driver's context usage into its run marker. The transcripts live in the newest run directory here:

\`\`\`bash
D=$(ls -td ~/.claude/projects/-Users-alfredoperez-dev-GitHub-speckit-companion/*/subagents/workflows/wf_* | head -1)
cd ${BENCH} && node record-tokens.mjs "$D"
\`\`\`

It must print exactly ${letters.length} cell(s) recorded. If it prints fewer, try the next-newest directory before reporting.

2. Measure, keeping the diffs for the judges:

\`\`\`bash
cd ${BENCH} && node run-all.mjs capture --sizes ${size} --modes companion,companion-living --no-reset
\`\`\`

Report the capture output verbatim in your final text, and nothing else. Do not run judges, do not commit, do not edit anything.`,
  { label: 'measure', phase: 'Measure', effort: 'low' },
)

const RUBRIC_SCHEMA = {
  type: 'object',
  properties: {
    cell: { type: 'string' },
    readability: { type: 'number' },
    conventions: { type: 'number' },
    scope: { type: 'number' },
    justification: { type: 'string' },
  },
  required: ['cell', 'readability', 'conventions', 'scope', 'justification'],
}

const rubric = (letter) => `You are reviewing one solution to a feature request in a React codebase. You did not write it.

The solution is the diff in \`${dirOf(letter)}\` against its baseline:

\`\`\`bash
git -C ${dirOf(letter)} diff bench-baseline
\`\`\`

Read that diff in full. Then read \`${dirOf(letter)}/CLAUDE.md\` (the conventions this codebase documents; Feature-Sliced Design, and the layering rules are load-bearing), \`${dirOf(letter)}/.specify/memory/constitution.md\`, and \`${BENCH}/prompts/conduit/${size}.md\` for what was asked, between the \`---\` rules.

Score three dimensions, each an integer 1 to 5:

- **readability**: would a maintainer who has never seen this understand it?
- **conventions**: does it follow the layering, slice sizing, contract and naming rules this codebase documents? Judge only rules the feature had occasion to exercise.
- **scope**: did it build what was asked, without building more?

Write your scores into the run marker, MERGING with what is already there (keep every field that is already present):

\`\`\`bash
node -e "
const fs=require('fs');
const f=${marker(letter)};
const j=JSON.parse(fs.readFileSync(f,'utf8'));
j.quality={readability:R,conventions:C,scope:S,justification:'...'};
fs.writeFileSync(f,JSON.stringify(j,null,2));
"
\`\`\`

Report the three scores and a two-sentence justification naming the strongest and weakest thing about the solution. You are told this cell's letter and nothing else; do not look at any other cell.`

const compare = `Two teams built the same feature independently in the same codebase. Compare their solutions.

${letters.map((l, i) => `${i + 1}. \`git -C ${dirOf(l)} diff bench-baseline\`  (solution ${l.toUpperCase()})`).join('\n')}

Then read what was asked, \`${BENCH}/prompts/conduit/${size}.md\` between the \`---\` rules, and the conventions in \`${dirOf(letters[0])}/CLAUDE.md\`.

Produce a comparative review, not isolated scores:

- **Ranking**, better first, one line of reasoning.
- **Head-to-head differences**: structure, layering, naming, edge cases, test coverage.
- **Suspected bugs a test suite would not catch**, per solution, or "none found". Probe rather than assume where you can.
- **One-line verdict per solution.**

Note also what each run wrote alongside the code: spec artifacts, and any change under \`capabilities/\`.

Write it to \`${BENCH}/reviews/${size}.md\`: read the existing file first, then PREPEND a section headed \`## ${sweep}\` so earlier rounds are preserved below. Refer to the solutions only by their letters.`

const judged = await parallel([
  ...letters.map((l) => () => agent(rubric(l), { label: `rubric:${size}-${l}`, phase: 'Judge', schema: RUBRIC_SCHEMA })),
  () => agent(compare, { label: `compare:${size}`, phase: 'Judge' }),
])

const RECORD_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mode: { type: 'string' },
          wallMin: { type: 'number' },
          implementMin: { type: 'number' },
          captureCalls: { type: 'number' },
          contextTokensM: { type: 'number' },
          modelTurns: { type: 'number' },
          captureEval: { type: 'string' },
          oracle: { type: 'string' },
          ownTests: { type: 'string' },
          work: { type: 'number' },
          doctor: { type: 'string' },
        },
        required: ['mode', 'wallMin', 'captureCalls', 'contextTokensM', 'modelTurns', 'oracle', 'work'],
      },
    },
    compareCalls: { type: 'string' },
    compareContext: { type: 'string' },
    commit: { type: 'string' },
  },
  required: ['rows', 'compareCalls', 'compareContext', 'commit'],
}

const recorded = await agent(
  `Finish recording the "${sweep}" round in ${BENCH}.

1. Fold the rubric scores into the composite (this resets the cells; the judges are done with them):

\`\`\`bash
cd ${BENCH} && node run-all.mjs capture --sizes ${size} --modes companion,companion-living
\`\`\`

2. Read the round against the sweeps before it, and keep the outputs:

\`\`\`bash
cd ${BENCH} && for m in calls context turns work oracle wall; do echo "== $m"; node run-all.mjs compare --metric $m; done
\`\`\`

3. Pull this sweep's two rows from \`stats.jsonl\` (the rows whose \`sweep\` is "${sweep}") and read every field a row carries: wall clock, the implement step's minutes if the step breakdown has it, captureCalls, contextTokens, modelTurns, capture eval, oracle passed/total, the run's own tests, Work, doctor problems.

4. Commit the round in ${BENCH}: \`git add stats.jsonl history.jsonl runs runs-meta reviews REPORT.md\` then commit with the message \`bench: ${sweep}\`. Do not push.

Return the two rows (mode = companion or companion-living), the verbatim \`calls\` and \`context\` compare tables, and the commit sha.`,
  { label: 'record', phase: 'Record', schema: RECORD_SCHEMA, effort: 'low' },
)

return { wave, sweep, built, measured, judged: judged.filter(Boolean), recorded }

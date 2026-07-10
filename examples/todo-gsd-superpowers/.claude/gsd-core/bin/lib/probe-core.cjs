"use strict";
/**
 * probe-core — generic spec-phase probe resolution model (ADR-550 Decision 7).
 *
 * Extracted from the edge-probe (the first adapter) once the prohibition probe (#644)
 * proved it the *second* adapter of the same model: one adapter is a hypothetical seam,
 * two is a real one. This module owns everything generic — the resolution lifecycle,
 * the status×verification re-cut, `validateResolution`/`validateRequirement`, the
 * `analyzeCoverage(items, resolutions?, validators)` merge/rollup/orphan-reject engine,
 * the `byVerification` rollup, and the `runProbeCli` I/O scaffold. Each probe is a thin
 * adapter: it supplies the proposal logic (deterministic for edge, LLM-recall for
 * prohibition) and its closed vocabularies via injected validators.
 *
 * Authored as strict TypeScript (`src/probe-core.cts`) and compiled by
 * `tsc -p tsconfig.build.json` to the gitignored runtime artifact
 * `gsd-core/bin/lib/probe-core.cjs`. Do NOT hand-write the `.cjs`; it is emitted.
 *
 * Two orthogonal axes (the re-cut):
 *   - status: resolved | dismissed | unresolved   — the resolution LIFECYCLE (shared)
 *   - verification: <probe-defined> | null          — HOW a resolved item is verified
 * The edge adapter declares `verification: explicit | backstop`; the prohibition adapter
 * (#644) will declare `test | judgment`. Splitting the axes keeps the lifecycle enum free
 * of a verification fact and lets a sibling probe add its own tiers without a parallel enum.
 *
 * Typing is hybrid (ADR-550 #5): generic type params for adapter DX, but enforcement runs
 * through injected runtime validators, because the CLI executes over JSON where TS types are
 * erased. The contract test pins the validators, not the types.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROHIBITION_VALIDATORS = exports.VALID_STATUS = void 0;
exports.validateRequirement = validateRequirement;
exports.validateResolution = validateResolution;
exports.analyzeCoverage = analyzeCoverage;
exports.validateProhibitionResolution = validateProhibitionResolution;
exports.projectProhibitions = projectProhibitions;
exports.dispositionForProhibition = dispositionForProhibition;
exports.runProbeCli = runProbeCli;
const node_fs_1 = __importDefault(require("node:fs"));
/** The LOCKED set of valid lifecycle statuses (the re-cut: no covered/backstop). */
exports.VALID_STATUS = ['resolved', 'dismissed', 'unresolved'];
function errMessage(e) {
    return e instanceof Error ? e.message : String(e);
}
/**
 * Structural guard for the report an adapter's `analyze` returns. The scaffold types `analyze`
 * loosely (it runs over JSON-parsed input the adapter `as`-casts), so a future adapter (#644)
 * that forgets to validate inside its closure could hand back a malformed object. Rather than
 * stringify garbage as green output, `runProbeCli` checks the report shape and fails closed.
 */
function isValidReport(report) {
    if (report == null || typeof report !== 'object')
        return false;
    const r = report;
    if (!Array.isArray(r.items))
        return false;
    const c = r.coverage;
    if (c == null || typeof c !== 'object')
        return false;
    if (typeof c.applicable !== 'number' || typeof c.resolved !== 'number' || typeof c.unresolved !== 'number') {
        return false;
    }
    if (c.byVerification == null || typeof c.byVerification !== 'object')
        return false;
    return true;
}
/**
 * Validate a requirement's generic structural fields — fail closed on malformed input rather
 * than coercing it. Probe-specific fields (e.g. the edge adapter's `shapes`) are validated by
 * the adapter. Typed loosely because the CLI casts arbitrary parsed JSON to `Requirement`.
 */
function validateRequirement(requirement) {
    const r = requirement;
    if (typeof r.id !== 'string' || !r.id.trim()) {
        throw new Error(`requirement id must be a non-empty string (got ${JSON.stringify(r.id)})`);
    }
    if (r.text != null && typeof r.text !== 'string') {
        throw new Error(`requirement ${r.id} text must be a string when present`);
    }
}
/**
 * Validate a resolution against the probe's injected validators. Rejects an unknown status,
 * a dismissal without a non-empty reason, a `resolved` item with a missing/unknown
 * verification tier, and a `resolved` item missing any field its tier requires (per
 * `requiredFieldsByVerification`). Returns true on success.
 */
function validateResolution(r, validators) {
    const key = `${r.requirement_id}::${r.category}`;
    if (!exports.VALID_STATUS.includes(r.status)) {
        throw new Error(`invalid status "${r.status}" for ${key}`);
    }
    // Invariant (this module's header): `verification` is null unless `status` is `resolved`.
    // Enforce it for EVERY status — a dismissed/unresolved resolution carrying a verification
    // tier would otherwise merge verbatim (`analyzeCoverage` below) and silently break the
    // model for the second adapter (#644) that inherits this seam. Fail closed across the full
    // status×verification space, not just `resolved`.
    if (r.status !== 'resolved' && r.verification != null) {
        throw new Error(`verification must be null unless status is "resolved" (got "${r.verification}") for ${key}`);
    }
    // An `unresolved` resolution is an UNACTED item: it must carry no resolution/reason payload.
    // A populated payload is an authoring mistake (the author meant resolved/dismissed) that
    // would otherwise be silently dropped into the unresolved count with no error pointing at
    // it. Reject it so the mistake surfaces.
    if (r.status === 'unresolved') {
        if (r.resolution != null && String(r.resolution).trim()) {
            throw new Error(`unresolved must not carry a resolution (${key})`);
        }
        if (r.reason != null && String(r.reason).trim()) {
            throw new Error(`unresolved must not carry a reason (${key})`);
        }
    }
    if (r.status === 'dismissed' && !(r.reason && String(r.reason).trim())) {
        throw new Error(`dismissed requires a reason (${key})`);
    }
    if (r.status === 'resolved') {
        const tier = r.verification;
        if (tier == null) {
            throw new Error(`resolved requires a verification tier (one of: ${validators.verification.join(', ')}) for ${key}`);
        }
        if (!validators.verification.includes(tier)) {
            throw new Error(`invalid verification "${tier}" for ${key} — must be one of: ${validators.verification.join(', ')}`);
        }
        const required = validators.requiredFieldsByVerification[tier] ?? [];
        for (const field of required) {
            // field is 'resolution' | 'reason'; both are `string | null | undefined` on Resolution,
            // so the indexed access is string-typed (no unknown-to-string coercion).
            const value = r[field];
            if (!(value != null && String(value).trim())) {
                throw new Error(`${tier} requires a ${field} (${key})`);
            }
        }
    }
    return true;
}
/**
 * Merge author resolutions onto ALREADY-PROPOSED items and roll up coverage counts.
 *
 * Core operates on `items[]`, never a `proposeFn`: probes have different deterministic
 * surfaces (edge = deterministic propose + LLM resolve; prohibition = LLM propose + deterministic
 * validate/merge), so proposal stays in each adapter and core must not assume it is deterministic.
 *
 * `coverage.resolved` is the COUNT of CLOSED items (`resolved` + `dismissed` status) =
 * `applicable - unresolved` — the pre-re-cut "covered + dismissed + backstop" set,
 * count-preserved. `byVerification` breaks the `resolved`-status items down by tier (each tier
 * initialized to 0). Throws on any invalid resolution, a duplicate, an orphan (a resolution
 * matching no proposed item), or a proposed item whose category is outside `validators.categories`.
 */
function analyzeCoverage(items, resolutions = [], validators) {
    if (!Array.isArray(items)) {
        throw new Error('items must be an array');
    }
    const key = (r) => `${r.requirement_id}::${r.category}`;
    const resMap = new Map();
    for (const r of resolutions) {
        validateResolution(r, validators);
        if (resMap.has(key(r))) {
            throw new Error(`duplicate resolution for ${key(r)}`);
        }
        resMap.set(key(r), r);
    }
    const validCategories = new Set(validators.categories);
    const merged = [];
    const itemKeys = new Set();
    for (const item of items) {
        if (!validCategories.has(item.category)) {
            throw new Error(`item ${key(item)} has unknown category "${item.category}" — not one of: ${validators.categories.join(', ')}`);
        }
        itemKeys.add(key(item));
        const o = resMap.get(key(item));
        if (o) {
            merged.push({ ...item, status: o.status, verification: o.verification ?? null, resolution: o.resolution ?? null, reason: o.reason ?? null });
        }
        else {
            // No author resolution: the item is rolled up VERBATIM, so its own status/fields must be
            // valid too. The edge adapter only proposes `unresolved` items, but the prohibition adapter
            // (#644) proposes LLM-generated items that arrive already populated — one carrying an
            // out-of-enum status (e.g. the dropped "covered") or `dismissed` with no reason would
            // otherwise be counted closed without validation. An Item is structurally a superset of a
            // Resolution, so the same fail-closed check guards both. (ADR-550 Decision 5 hardens this
            // shared seam for the second adapter; m1.)
            validateResolution(item, validators);
            merged.push(item);
        }
    }
    // Reject orphan resolutions — a resolution whose (requirement_id, category) matches no
    // proposed item (typo'd category or a non-applicable one) would otherwise be silently
    // dropped, leaving the author believing an item is resolved while the report shows it
    // unresolved (adversarial-review HIGH; preserved from the edge-probe's original engine).
    for (const k of resMap.keys()) {
        if (!itemKeys.has(k)) {
            throw new Error(`unknown resolution for ${k} — no matching proposed item (typo'd category or non-applicable shape?)`);
        }
    }
    const unresolved = merged.filter((i) => i.status === 'unresolved').length;
    const applicable = merged.length;
    const resolved = applicable - unresolved; // closed set: resolved-status + dismissed
    const byVerification = {};
    for (const tier of validators.verification)
        byVerification[tier] = 0;
    for (const i of merged) {
        if (i.status === 'resolved' && i.verification != null) {
            byVerification[i.verification] = (byVerification[i.verification] ?? 0) + 1;
        }
    }
    return { items: merged, coverage: { applicable, resolved, unresolved, byVerification } };
}
/**
 * The prohibition adapter's injected runtime validators (ADR-550 #5). There is no closed
 * category taxonomy (recall is open-vocabulary values/safety/ethics prose), so `categories`
 * is intentionally empty — `analyzeCoverage` is not the prohibition entry point and the
 * round-trip schema layer does not gate on category. The verification tiers are
 * `test | judgment` (ADR-550 D7a); both require only a present `resolution`/`reason` per their
 * lifecycle (a resolved prohibition's checkable content is the `statement`, validated by the
 * schema layer, not a `resolution` string), so `requiredFieldsByVerification` is the minimal
 * fail-closed set: a dismissed item still needs its reason (enforced by `validateResolution`).
 */
exports.PROHIBITION_VALIDATORS = {
    categories: [],
    verification: ['test', 'judgment'],
    // A resolved prohibition's checkable content is the `statement` (schema-layer validated), NOT a
    // `resolution` string — the canonical fixtures and the reference doc's worked examples all carry
    // `resolution: null`. So the per-tier required set is empty: `resolved` still requires a present
    // verification tier (enforced in validateResolution) and `dismissed` still requires a reason
    // (enforced unconditionally), but neither tier requires a `resolution`. This matches the corpus
    // the docs-fixtures parity test pins; the validators.test.cjs regression keeps them aligned.
    requiredFieldsByVerification: { test: [], judgment: [] },
};
/** Validate a prohibition resolution against the prohibition verification vocabulary. */
function validateProhibitionResolution(resolution) {
    return validateResolution(resolution, exports.PROHIBITION_VALIDATORS);
}
/**
 * Deterministically project resolved prohibition items into the `must_haves.prohibitions:`
 * list shape (the SPEC<->plan projection; ADR-550 Decision 5c). This is a FUNCTION the parity
 * assertion round-trips, never a prompt: the same input always yields the same output, and the
 * output is the exact re-readable block shape `parseMustHavesBlock(content, 'prohibitions')`
 * returns — `{ statement, status, verification }` plus `reason` only when present (a dismissed
 * item's audit trail). `resolution`/`requirement_id`/`category` are recall-stage bookkeeping
 * and are intentionally NOT projected into the plan block (which is keyed on the must-NOT
 * statement, not the source requirement). A non-array input projects to `[]` (fail-soft on the
 * empty/zero-prohibition case), never a throw.
 *
 * An OPTIONAL wired-check descriptor (#1278) projects as the LOCKED flat scalar keys
 * `check_kind`/`check_target`/`check_rule` (NEVER a nested `check:{}` object; `failFirst` is never
 * projected). These ride the EXISTING continuation-KV path of `parseMustHavesBlock`
 * (src/frontmatter.cts:344) with NO shared-parser rewrite (IMPL-SCOPING §3 Option 1). The keys are
 * emitted ONLY for a well-formed descriptor (valid `check_kind` + non-empty `check_target`; plus
 * `check_rule` only for a lint-rule that carries one); a descriptor-less or under-specified item is
 * byte-identical to today (CHK-07), so an under-specified descriptor projects absent and fails closed
 * at the producer downstream (CHK-06), never as a partial-but-locatable green.
 */
function projectProhibitions(items) {
    if (!Array.isArray(items))
        return [];
    const out = [];
    for (const item of items) {
        if (item == null || typeof item !== 'object')
            continue;
        const p = item;
        const statement = typeof p.statement === 'string' ? p.statement : '';
        const entry = {
            statement,
            status: typeof p.status === 'string' ? p.status : 'unresolved',
        };
        if (p.verification != null)
            entry.verification = String(p.verification);
        if (p.reason != null && String(p.reason).trim())
            entry.reason = String(p.reason);
        // Optional wired-check descriptor (#1278): emit flat scalars ONLY when well-formed. A valid kind
        // plus a non-empty target is the minimum; under that bar nothing is emitted (CHK-07 byte-identity,
        // and the producer fails closed on the absent descriptor — CHK-06).
        const kind = p.check_kind;
        const targetOk = typeof p.check_target === 'string' && p.check_target.trim() !== '';
        if ((kind === 'node-test' || kind === 'lint-rule') && targetOk) {
            entry.check_kind = kind;
            entry.check_target = String(p.check_target);
            // `check_rule` rides only the lint-rule path (node-test never carries one); a lint-rule missing
            // its rule leaves check_rule absent so the producer's fail-closed locate rejects it (CHK-06).
            if (kind === 'lint-rule' && typeof p.check_rule === 'string' && p.check_rule.trim() !== '') {
                entry.check_rule = String(p.check_rule);
            }
            // `check_violation_fixture` (#1346) rides BOTH kinds — it's what the #1279 prover machine-proves
            // fail-first against. Emit ONLY a non-empty fixture (a blank one projects absent so green still
            // hard-gates downstream — never a partial green); meaningless without the descriptor, so it lives
            // inside this well-formed-descriptor branch.
            if (typeof p.check_violation_fixture === 'string' && p.check_violation_fixture.trim() !== '') {
                entry.check_violation_fixture = String(p.check_violation_fixture);
            }
            // `check_clean_fixture` (#1346) rides BOTH kinds — the KNOWN-CLEAN control subject the prover
            // requires to stay GREEN (content-dependence proof). Emit ONLY a non-empty fixture (blank ->
            // absent so no control runs; the documented residual remains). Like the violation fixture it is
            // meaningless without the descriptor, so it lives inside this well-formed-descriptor branch.
            if (typeof p.check_clean_fixture === 'string' && p.check_clean_fixture.trim() !== '') {
                entry.check_clean_fixture = String(p.check_clean_fixture);
            }
        }
        out.push(entry);
    }
    return out;
}
/**
 * Deterministic verify-time disposition for a single prohibition — the FAIL-CLOSED default
 * (ADR-550 Decision 5d, the safety half of the 2026-06-12 "B-with-guard" maintainer decision).
 *
 * This is the cheap safety guarantee: a well-formed prohibition that reaches verify-phase with NO
 * wired enforcement evidence can NEVER be a silent pass. It is `{ status: 'unverified', flagged:
 * true }` — never `green` — exactly like an unresolved judgment item. The HEAVY half (a real
 * negative-test enforcement mechanism that, given evidence, flips a test-tier item to green) was OUT
 * of #644 scope and LANDED in #1259 as the `prohibition-enforcement` producer (it builds the
 * `enforcementEvidence` this helper reads). This helper's policy is unchanged: ANY prohibition
 * without enforcement evidence — test- or judgment-tier — disposes as flagged-unverified.
 *
 * The function is pure: same input always yields the same disposition (no LLM judgment, ADR-550
 * D5). The LLM-judge soft-gate for judgment-tier items is a verify-phase PROSE concern (the
 * verifier records a non-authoritative verdict + the unverified-prohibition flag); this helper
 * only owns the deterministic fail-closed default that the plan-01-01 CI safety assertion pins.
 */
function dispositionForProhibition(prohibition, context = {}) {
    const p = (prohibition ?? {});
    const tier = p.verification === 'test' || p.verification === 'judgment' ? p.verification : null;
    const evidence = Array.isArray(context.enforcementEvidence) ? context.enforcementEvidence : [];
    const hasEnforcement = evidence.length > 0;
    // FAIL CLOSED: no wired enforcement evidence -> flagged unverified, never green. This holds for
    // every tier (the producer that builds enforcement evidence for a test-tier item — the
    // `prohibition-enforcement` module — landed in #1259). The guard the safety assertion proves: an
    // unwired item can never be silently skipped.
    if (!hasEnforcement) {
        return {
            status: 'unverified',
            flagged: true,
            tier,
            reason: tier === 'test'
                ? 'test-tier prohibition has no passing wired enforcement check — flagged unverified (fail-closed; never a silent pass, ADR-550 D5d)'
                : 'prohibition has no enforcement evidence — flagged unverified (fail-closed; never a silent pass, ADR-550 D5d)',
        };
    }
    // D4 GUARD: a judgment-tier (or unknown-tier) prohibition is NEVER a silent green from this
    // deterministic helper — it always routes to human/LLM judgment review (ADR-550 D4; verify-phase.md).
    // Only a test-tier item with wired enforcement evidence may go green; the producer that supplies
    // that evidence (`prohibition-enforcement`, #1259) runs the wired check and requires a genuine pass.
    if (tier === 'test') {
        return {
            status: 'green',
            flagged: false,
            tier,
            reason: 'test-tier prohibition has wired enforcement evidence',
        };
    }
    return {
        status: 'unverified',
        flagged: true,
        tier,
        reason: 'judgment-tier prohibition routes to judgment review — never a silent green (ADR-550 D4)',
    };
}
/**
 * Read the requirements file (and optional resolutions file), run the adapter's `analyze`,
 * and write the report as pretty JSON + newline. With no requirements path, writes the usage
 * line to stderr and exits 2. A JSON-parse failure or any `analyze` throw is a handled error:
 * stderr + exit 2, never an uncaught stack trace — so the engine's fail-closed validation
 * surfaces at the workflow boundary rather than failing open.
 */
function runProbeCli(analyze, options) {
    const argv = options.argv ?? process.argv;
    const readFile = options.readFile ?? ((p) => node_fs_1.default.readFileSync(p, 'utf8'));
    const write = options.write ?? ((s) => { process.stdout.write(s); });
    const writeErr = options.writeErr ?? ((s) => { process.stderr.write(s); });
    const exit = options.exit ?? ((code) => { process.exit(code); });
    const reqPath = argv[2];
    const resPath = argv[3];
    if (!reqPath) {
        writeErr(`usage: ${options.usage}\n`);
        exit(2);
        return;
    }
    let requirements;
    try {
        requirements = JSON.parse(readFile(reqPath));
    }
    catch (e) {
        writeErr(`error: cannot parse JSON from ${reqPath}: ${errMessage(e)}\n`);
        exit(2);
        return;
    }
    let resolutions = [];
    if (resPath) {
        try {
            resolutions = JSON.parse(readFile(resPath));
        }
        catch (e) {
            writeErr(`error: cannot parse JSON from ${resPath}: ${errMessage(e)}\n`);
            exit(2);
            return;
        }
    }
    try {
        const report = analyze(requirements, resolutions);
        if (!isValidReport(report)) {
            throw new Error('adapter returned a structurally-invalid coverage report (expected { items[], coverage{ applicable, resolved, unresolved, byVerification } })');
        }
        write(`${JSON.stringify(report, null, 2)}\n`);
    }
    catch (e) {
        writeErr(`error: ${errMessage(e)}\n`);
        exit(2);
    }
}

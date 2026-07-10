"use strict";
/**
 * Security — Input validation, path traversal prevention, and prompt injection guards
 *
 * This module centralizes security checks for GSD tooling. Because GSD generates
 * markdown files that become LLM system prompts (agent instructions, workflow state,
 * phase plans), any user-controlled text that flows into these files is a potential
 * indirect prompt injection vector.
 *
 * Threat model:
 *   1. Path traversal: user-supplied file paths escape the project directory
 *   2. Prompt injection: malicious text in arguments/PRDs embeds LLM instructions
 *   3. Shell metacharacter injection: user text interpreted by shell
 *   4. JSON injection: malformed JSON crashes or corrupts state
 *   5. Regex DoS: crafted input causes catastrophic backtracking
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/security.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKDOWN_LINK_PATTERNS = exports.INJECTION_PATTERNS = void 0;
exports.validatePath = validatePath;
exports.loadTrustedGlobalRoots = loadTrustedGlobalRoots;
exports.requireSafePath = requireSafePath;
exports.scanForInjection = scanForInjection;
exports.sanitizeForPrompt = sanitizeForPrompt;
exports.sanitizeForDisplay = sanitizeForDisplay;
exports.validateShellArg = validateShellArg;
exports.safeJsonParse = safeJsonParse;
exports.validatePhaseNumber = validatePhaseNumber;
exports.validateFieldName = validateFieldName;
exports.validatePromptStructure = validatePromptStructure;
exports.scanEntropyAnomalies = scanEntropyAnomalies;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
// ─── Path Traversal Prevention ──────────────────────────────────────────────
/**
 * Validate that a file path resolves within an allowed base directory.
 * Prevents path traversal attacks via ../ sequences, symlinks, or absolute paths.
 */
function validatePath(filePath, baseDir, opts = {}) {
    if (!filePath || typeof filePath !== 'string') {
        return { safe: false, resolved: '', error: 'Empty or invalid file path' };
    }
    if (!baseDir || typeof baseDir !== 'string') {
        return { safe: false, resolved: '', error: 'Empty or invalid base directory' };
    }
    if (filePath.includes('\0')) {
        return { safe: false, resolved: '', error: 'Path contains null bytes' };
    }
    let resolvedBase;
    try {
        resolvedBase = node_fs_1.default.realpathSync(node_path_1.default.resolve(baseDir));
    }
    catch {
        resolvedBase = node_path_1.default.resolve(baseDir);
    }
    let resolvedPath;
    if (node_path_1.default.isAbsolute(filePath)) {
        if (!opts.allowAbsolute) {
            return { safe: false, resolved: '', error: 'Absolute paths not allowed' };
        }
        resolvedPath = node_path_1.default.resolve(filePath);
    }
    else {
        resolvedPath = node_path_1.default.resolve(baseDir, filePath);
    }
    try {
        resolvedPath = node_fs_1.default.realpathSync(resolvedPath);
    }
    catch {
        const parentDir = node_path_1.default.dirname(resolvedPath);
        try {
            const realParent = node_fs_1.default.realpathSync(parentDir);
            resolvedPath = node_path_1.default.join(realParent, node_path_1.default.basename(resolvedPath));
        }
        catch {
            // Parent doesn't exist either — keep the resolved path as-is
        }
    }
    const normalizedBase = resolvedBase + node_path_1.default.sep;
    const normalizedPath = resolvedPath + node_path_1.default.sep;
    if (resolvedPath !== resolvedBase && !normalizedPath.startsWith(normalizedBase)) {
        return {
            safe: false,
            resolved: resolvedPath,
            error: `Path escapes allowed directory: ${resolvedPath} is outside ${resolvedBase}`,
        };
    }
    return { safe: true, resolved: resolvedPath };
}
/**
 * Load the opt-in trusted global roots allowlist from config.
 *
 * Reads `config.agent_skills_security.trusted_global_roots` (an array of
 * path strings). Each entry is canonicalized via realpathSync: non-strings
 * are dropped, leading `~/` is expanded to `os.homedir()`, entries that are
 * not absolute after expansion are dropped (project-relative paths are
 * rejected as a security boundary), and entries that do not exist on disk are
 * dropped (a non-existent root is not trustworthy). The canonical realpath is
 * used for all subsequent checks and as the stored value — this closes the
 * case-insensitive bypass on macOS APFS (`/users/alice` vs `/Users/alice`)
 * and ensures trust doesn't drift across re-invocations if a root is
 * re-created at a different target. Results are de-duplicated by canonical path.
 */
function loadTrustedGlobalRoots(config) {
    const roots = config?.['agent_skills_security'];
    const raw = roots?.['trusted_global_roots'];
    if (!Array.isArray(raw))
        return [];
    // Compute canonical homedir once for case-insensitive-safe comparison.
    let realHome;
    try {
        realHome = node_fs_1.default.realpathSync(node_os_1.default.homedir());
    }
    catch {
        realHome = node_os_1.default.homedir();
    }
    const seen = new Set();
    const result = [];
    for (const entry of raw) {
        if (typeof entry !== 'string')
            continue;
        let expanded;
        if (entry === '~') {
            expanded = node_os_1.default.homedir();
        }
        else if (entry.startsWith('~/')) {
            expanded = node_path_1.default.join(node_os_1.default.homedir(), entry.slice(2));
        }
        else {
            expanded = entry;
        }
        if (!node_path_1.default.isAbsolute(expanded))
            continue; // reject project-relative
        // Canonicalize: resolve symlinks and normalise case. If the path doesn't
        // exist or can't be read, skip it — a non-existent root is not trustworthy.
        let real;
        try {
            real = node_fs_1.default.realpathSync(expanded);
        }
        catch {
            continue; // non-existent or unreadable — skip
        }
        // Reject dangerously broad roots: filesystem root (e.g. '/' or 'C:\' or UNC '\\server\share').
        // Normalize both sides by stripping trailing path separators before comparing so that
        // Windows UNC shares (where path.parse().root includes a trailing separator) are caught.
        const stripTrailingSep = (p) => p.replace(/[\\/]+$/, '');
        if (stripTrailingSep(node_path_1.default.parse(real).root) === stripTrailingSep(real))
            continue;
        // Reject homedir itself (canonical compare closes case-insensitive bypass).
        // Apply stripTrailingSep for robustness on platforms where realpathSync may
        // or may not include a trailing separator on the homedir path.
        if (stripTrailingSep(real) === stripTrailingSep(realHome))
            continue;
        if (seen.has(real))
            continue;
        seen.add(real);
        result.push(real);
    }
    return result;
}
/**
 * Validate a file path and throw on traversal attempt.
 * Convenience wrapper around validatePath for use in CLI commands.
 */
function requireSafePath(filePath, baseDir, label, opts = {}) {
    const result = validatePath(filePath, baseDir, opts);
    if (!result.safe) {
        throw new Error(`${label || 'Path'} validation failed: ${result.error}`);
    }
    return result.resolved;
}
// ─── Prompt Injection Detection ────────────────────────────────────────────────────
/**
 * Patterns that indicate prompt injection attempts in user-supplied text.
 * These patterns catch common indirect prompt injection techniques where
 * an attacker embeds LLM instructions in text that will be read by an agent.
 *
 * Note: This is defense-in-depth — not a complete solution. The primary defense
 * is proper input/output boundaries in agent prompts.
 */
exports.INJECTION_PATTERNS = [
    // Direct instruction override attempts
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /ignore\s+(all\s+)?above\s+instructions/i,
    /disregard\s+(all\s+)?previous/i,
    /forget\s+(all\s+)?(your\s+)?instructions/i,
    /override\s+(system|previous)\s+(prompt|instructions)/i,
    // Role/identity manipulation
    /you\s+are\s+now\s+(?:a|an|the)\s+/i,
    /act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave)/i,
    /pretend\s+(?:you(?:'re| are)\s+|to\s+be\s+)/i,
    /from\s+now\s+on,?\s+you\s+(?:are|will|should|must)/i,
    // System prompt extraction
    /(?:print|output|reveal|show|display|repeat)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions)/i,
    /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions)/i,
    // Hidden instruction markers (XML/HTML tags that mimic system messages)
    // Note: <instructions> is excluded — GSD uses it as legitimate prompt structure
    // Requires > to close the tag (not just whitespace) to avoid matching generic types like Promise<User | null>
    /<\/?(?:system|assistant|human)>/i,
    /\[SYSTEM\]/i,
    /\[\/?(INST)\]/i,
    /<<\s*SYS\s*>>/i,
    // Exfiltration attempts
    /(?:send|post|fetch|curl|wget)\s+(?:to|from)\s+https?:\/\//i,
    /(?:base64|btoa|encode)\s+(?:and\s+)?(?:send|exfiltrate|output)/i,
    // Tool manipulation
    /(?:run|execute|call|invoke)\s+(?:the\s+)?(?:bash|shell|exec|spawn)\s+(?:tool|command)/i,
];
// Explicit safe-list for data: MIME types that are benign in link targets.
// Note: image/svg+xml is intentionally NOT in this list (SVG can host <script>).
const DATA_URI_SAFE_MIME_RE = /^data:(image\/(png|jpe?g|gif|webp|bmp|ico|avif|heic)|font\/(woff2?|otf|ttf))(;[^,]*)?,/i;
exports.MARKDOWN_LINK_PATTERNS = [
    {
        pattern: /\]\(\s*javascript:/i,
        ruleId: 'MD-LINK-JS-SCHEME',
    },
    {
        pattern: /\]\(\s*data:/i,
        ruleId: 'MD-LINK-DATA-SCHEME',
        safePredicate: (line) => {
            const m = line.match(/\]\(\s*(data:[^)]*)/i);
            if (!m)
                return false;
            return DATA_URI_SAFE_MIME_RE.test(m[1]);
        },
    },
    {
        pattern: /\]\(\s*https?:\/\/[^/\s]+:[^/@\s]+@/i,
        ruleId: 'MD-LINK-USERINFO',
    },
    {
        pattern: /[?&](token|access_token|id_token|refresh_token|api_key|apikey|secret|password|client_secret|code)=/i,
        ruleId: 'MD-LINK-TOKEN-IN-QUERY',
    },
];
const OBFUSCATION_PATTERN_ENTRIES = [
    {
        pattern: /\b(\w\s){4,}\w\b/,
        message: 'Character-spacing obfuscation pattern detected (e.g. "i g n o r e")',
    },
    {
        pattern: /<\/?(system|human|assistant|user)\s*>/i,
        message: 'Delimiter injection pattern: <system>/<human>/<assistant>/<user> tag detected',
    },
    {
        pattern: /0x[0-9a-fA-F]{16,}/,
        message: 'Long hex sequence detected — possible encoded payload',
    },
];
/**
 * Scan text for potential prompt injection patterns.
 * Returns an array of findings (empty = clean).
 */
function scanForInjection(text, opts = {}) {
    if (!text || typeof text !== 'string') {
        return { clean: true, findings: [], structuredFindings: [] };
    }
    const findings = [];
    const structuredFindings = [];
    for (const pattern of exports.INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            findings.push(`Matched injection pattern: ${pattern.source}`);
        }
    }
    for (const entry of OBFUSCATION_PATTERN_ENTRIES) {
        if (entry.pattern.test(text)) {
            findings.push(entry.message);
        }
    }
    const lines = text.split('\n');
    for (const entry of exports.MARKDOWN_LINK_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const m = line.match(entry.pattern);
            if (!m)
                continue;
            if (entry.safePredicate && entry.safePredicate(line))
                continue;
            const matchText = m[0];
            findings.push(`Matched markdown link pattern [${entry.ruleId}]: ${matchText}`);
            structuredFindings.push({
                ruleId: entry.ruleId,
                file: opts.file,
                line: i + 1,
                match: matchText,
            });
        }
    }
    if (opts.strict) {
        // Check for suspicious Unicode that could hide instructions
        // (zero-width chars, RTL override, homoglyph attacks)
        if (/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/.test(text)) {
            findings.push('Contains suspicious zero-width or invisible Unicode characters');
        }
        // Layer 1: Unicode tag block U+E0000–E007F (2025 supply-chain attack vector)
        // These characters are invisible and can embed hidden instructions
        if (/[\uDB40\uDC00-\uDB40\uDC7F]/u.test(text) || /[\u{E0000}-\u{E007F}]/u.test(text)) {
            findings.push('Contains Unicode tag block characters (U+E0000–E007F) — invisible instruction injection vector');
        }
        // Check for extremely long strings that could be prompt stuffing.
        // Normalize CRLF → LF before measuring so Windows checkouts don't inflate the count.
        const normalizedLength = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').length;
        if (normalizedLength > 50000) {
            findings.push(`Suspicious text length: ${normalizedLength} chars (potential prompt stuffing)`);
        }
    }
    return { clean: findings.length === 0, findings, structuredFindings };
}
/**
 * Sanitize text that will be embedded in agent prompts or planning documents.
 * Strips known injection markers while preserving legitimate content.
 */
function sanitizeForPrompt(text) {
    if (!text || typeof text !== 'string')
        return text;
    let sanitized = text;
    // Strip zero-width characters that could hide instructions
    sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
    // Neutralize XML/HTML tags that mimic system boundaries
    // Note: <instructions> is excluded — GSD uses it as legitimate prompt structure
    sanitized = sanitized.replace(/<(\/?)\s*(?:system|assistant|human|user)\s*>/gi, (_, slash) => `＜${slash || ''}system-text＞`);
    // Neutralize [SYSTEM] / [INST] / [/INST] markers
    sanitized = sanitized.replace(/\[(\/?)(SYSTEM|INST)\]/gi, (_, slash, tag) => `[${slash}${tag.toUpperCase()}-TEXT]`);
    // Neutralize <<SYS>> and <</SYS>> markers (Llama-style delimiters)
    sanitized = sanitized.replace(/<<\/?\s*SYS\s*>>/gi, '«SYS-TEXT»');
    return sanitized;
}
/**
 * Sanitize text that will be displayed back to the user.
 * Removes protocol-like leak markers that should never surface in checkpoints.
 */
function sanitizeForDisplay(text) {
    if (!text || typeof text !== 'string')
        return text;
    let sanitized = sanitizeForPrompt(text);
    const protocolLeakPatterns = [
        /^\s*(?:assistant|user|system)\s+to=[^:\s]+:[^\n]+$/i,
        /^\s*<\|(?:assistant|user|system)[^|]*\|>\s*$/i,
    ];
    sanitized = sanitized
        .split('\n')
        .filter(line => !protocolLeakPatterns.some(pattern => pattern.test(line)))
        .join('\n');
    return sanitized;
}
// ─── Shell Safety ───────────────────────────────────────────────────────────────────────
/**
 * Validate that a string is safe to use as a shell argument when quoted.
 */
function validateShellArg(value, label) {
    if (!value || typeof value !== 'string') {
        throw new Error(`${label || 'Argument'}: empty or invalid value`);
    }
    if (value.includes('\0')) {
        throw new Error(`${label || 'Argument'}: contains null bytes`);
    }
    if (/[$`]/.test(value) && /\$\(|`/.test(value)) {
        throw new Error(`${label || 'Argument'}: contains potential command substitution`);
    }
    return value;
}
// ─── JSON Safety ──────────────────────────────────────────────────────────────────────────
/**
 * Safely parse JSON with error handling and optional size limits.
 */
function safeJsonParse(text, opts = {}) {
    const maxLength = opts.maxLength || 1048576;
    const label = opts.label || 'JSON';
    if (!text || typeof text !== 'string') {
        return { ok: false, error: `${label}: empty or invalid input` };
    }
    if (text.length > maxLength) {
        return { ok: false, error: `${label}: input exceeds ${maxLength} byte limit (got ${text.length})` };
    }
    try {
        const value = JSON.parse(text);
        return { ok: true, value };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `${label}: parse error — ${msg}` };
    }
}
// ─── Phase/Argument Validation ─────────────────────────────────────────────────────────
/**
 * Validate a phase number argument.
 */
function validatePhaseNumber(phase) {
    if (!phase || typeof phase !== 'string') {
        return { valid: false, error: 'Phase number is required' };
    }
    const trimmed = phase.trim();
    if (/^\d{1,4}[A-Z]?(?:\.\d{1,3})*$/i.test(trimmed)) {
        return { valid: true, normalized: trimmed };
    }
    if (/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,4}$/i.test(trimmed) && trimmed.length <= 30) {
        return { valid: true, normalized: trimmed };
    }
    return { valid: false, error: `Invalid phase number format: "${trimmed}"` };
}
/**
 * Validate a STATE.md field name to prevent injection into regex patterns.
 */
function validateFieldName(field) {
    if (!field || typeof field !== 'string') {
        return { valid: false, error: 'Field name is required' };
    }
    if (/^[A-Za-z][A-Za-z0-9 _.\-/]{0,60}$/.test(field)) {
        return { valid: true };
    }
    return { valid: false, error: `Invalid field name: "${field}"` };
}
// ─── Layer 3: Structural Schema Validation ──────────────────────────────────────────────────────────────────────────
const KNOWN_VALID_TAGS = new Set([
    'objective', 'process', 'step', 'success_criteria', 'critical_rules',
    'available_agent_types', 'purpose', 'required_reading',
]);
/**
 * Validate the XML structure of a prompt file.
 */
function validatePromptStructure(text, fileType) {
    if (!text || typeof text !== 'string') {
        return { valid: true, violations: [] };
    }
    if (fileType !== 'agent' && fileType !== 'workflow') {
        return { valid: true, violations: [] };
    }
    const violations = [];
    const tagRegex = /<([A-Za-z][A-Za-z0-9_-]*)/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        const tag = match[1].toLowerCase();
        if (!KNOWN_VALID_TAGS.has(tag)) {
            violations.push(`Unknown XML tag in ${fileType} file: <${tag}>`);
        }
    }
    return { valid: violations.length === 0, violations };
}
// ─── Layer 4: Paragraph-Level Entropy Anomaly Detection ─────────────────────────────────────────────────────────────────────
function shannonEntropy(text) {
    if (!text || text.length === 0)
        return 0;
    const freq = {};
    for (const ch of text) {
        freq[ch] = (freq[ch] || 0) + 1;
    }
    const len = text.length;
    let entropy = 0;
    for (const count of Object.values(freq)) {
        const p = count / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
/**
 * Scan text for paragraphs with anomalously high Shannon entropy.
 */
function scanEntropyAnomalies(text) {
    if (!text || typeof text !== 'string') {
        return { clean: true, findings: [] };
    }
    const findings = [];
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
        if (para.length <= 50)
            continue;
        const entropy = shannonEntropy(para);
        if (entropy > 5.5) {
            findings.push(`High-entropy paragraph detected (${entropy.toFixed(2)} bits/char) — possible encoded payload`);
        }
    }
    return { clean: findings.length === 0, findings };
}

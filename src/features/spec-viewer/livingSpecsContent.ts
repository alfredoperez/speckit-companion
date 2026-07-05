import * as fs from 'fs';
import * as path from 'path';
import { LivingSpecsView, CapabilityContentView } from '../../core/types/specContext';
import { readLivingSpecs, isPathWithinRoot, ResolvedCapability } from '../specs/livingSpecsModel';

/** Read cap per capability spec — a partial render would lie, so bigger files degrade to unavailable. */
const MAX_SPEC_BYTES = 256 * 1024;

const DELTA_HEADER_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i;
const CAP_MARKER_RE = /<!--\s*capability:\s*([^\s>]+)\s*-->/i;
const REQ_HEADING_RE = /^###\s+(.+?)\s*$/;

export interface DeltaCounts {
    added?: number;
    modified?: number;
    removed?: number;
    renamed?: number;
}

/** Strip inline markdown markers so the webview renders plain text nodes. */
export function stripInlineMarkdown(text: string): string {
    return text
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/`([^`]*)`/g, '$1')
        .trim();
}

/**
 * Parse a living-spec document into purpose + requirement rows. Mirrors the
 * fold-back writer's shape: title line, optional intro paragraph, then
 * `### <heading>` blocks (span ends at the next `###`/`##` or EOF) whose first
 * body paragraph becomes the row text.
 */
export function parseCapabilitySpec(md: string): { purpose?: string; requirements: { id: string; text: string }[] } {
    const lines = md.split(/\r?\n/);
    const requirements: { id: string; text: string }[] = [];
    let purpose: string | undefined;

    const introLines: string[] = [];
    for (const line of lines) {
        if (/^#{1,3}\s/.test(line)) {
            if (line.startsWith('# ')) continue;
            break;
        }
        introLines.push(line);
    }
    const intro = firstParagraph(introLines);
    if (intro) purpose = stripInlineMarkdown(intro);

    // Requirement rows live only under `## Requirements` — a `###` heading in
    // any other section (Scenarios, Notes) is not a requirement.
    let inRequirements = false;
    let current: { id: string; body: string[] } | null = null;
    const flush = () => {
        if (!current) return;
        const text = firstParagraph(current.body);
        requirements.push({ id: stripInlineMarkdown(current.id), text: text ? stripInlineMarkdown(text) : '' });
        current = null;
    };
    for (const line of lines) {
        if (line.startsWith('## ')) {
            flush();
            inRequirements = /^##\s+Requirements\s*$/i.test(line);
            continue;
        }
        if (!inRequirements) continue;
        const m = REQ_HEADING_RE.exec(line);
        if (m) {
            flush();
            current = { id: m[1].trim(), body: [] };
            continue;
        }
        if (current) current.body.push(line);
    }
    flush();
    return { purpose, requirements };
}

function firstParagraph(lines: string[]): string | null {
    const out: string[] = [];
    for (const line of lines) {
        const t = line.trim();
        if (t === '') {
            if (out.length > 0) break;
            continue;
        }
        out.push(t);
    }
    return out.length > 0 ? out.join(' ') : null;
}

/**
 * Per-capability delta counts from a feature spec's delta blocks, following the
 * fold script's targeting: a block's `<!-- capability: name -->` marker wins;
 * an unmarked block targets the default (most-specific loaded) capability.
 */
export function parseDeltaCounts(specText: string, defaultCapability: string | undefined): Map<string, DeltaCounts> {
    const counts = new Map<string, DeltaCounts>();
    const lines = specText.split(/\r?\n/);
    let verb: keyof DeltaCounts | null = null;
    let buf: string[] = [];

    const flush = () => {
        if (!verb) return;
        const body = buf.join('\n');
        const marker = CAP_MARKER_RE.exec(body);
        const target = marker ? marker[1].trim() : defaultCapability;
        const n = buf.filter(l => REQ_HEADING_RE.test(l)).length;
        if (target && n > 0) {
            const entry = counts.get(target) ?? {};
            entry[verb] = (entry[verb] ?? 0) + n;
            counts.set(target, entry);
        }
    };

    for (const line of lines) {
        const hm = DELTA_HEADER_RE.exec(line);
        if (hm) {
            flush();
            verb = hm[1].toLowerCase() as keyof DeltaCounts;
            buf = [];
            continue;
        }
        if (line.startsWith('## ') && verb) {
            flush();
            verb = null;
            buf = [];
            continue;
        }
        if (verb) buf.push(line);
    }
    flush();
    return counts;
}

function readCapped(absPath: string): string | null {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_SPEC_BYTES) return null;
        return fs.readFileSync(absPath, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Enrich a names-only living-specs view with per-capability readable content.
 * Best-effort everywhere: unresolved/missing/oversized specs yield
 * `available: false`; any unexpected failure returns the view unchanged so the
 * panel falls back to the names-only list.
 */
export function enrichLivingSpecs(
    view: LivingSpecsView,
    workspaceRoot: string,
    featureSpecPath?: string
): LivingSpecsView {
    try {
        // Skip orphan discovery — it walks the workspace and this runs per render.
        const listing = readLivingSpecs(workspaceRoot, { withOrphans: false });
        const byName = new Map<string, ResolvedCapability>(listing.capabilities.map(c => [c.name, c]));
        const synced = new Set(view.synced);

        const names = [...new Set([...view.loaded, ...view.synced])];

        // Fold targeting default: the most-specific loaded capability.
        const defaultCap = view.loaded[0] ?? view.synced[0];
        let deltas = new Map<string, DeltaCounts>();
        if (featureSpecPath) {
            const specText = readCapped(featureSpecPath);
            if (specText) deltas = parseDeltaCounts(specText, defaultCap);
        }

        const capabilities: CapabilityContentView[] = names.map(name => {
            const base: CapabilityContentView = { name, available: false, synced: synced.has(name) };
            const delta = deltas.get(name);
            if (base.synced && delta && Object.keys(delta).length > 0) base.delta = delta;

            const resolved = byName.get(name);
            if (!resolved || !resolved.spec || !isPathWithinRoot(workspaceRoot, resolved.spec)) return base;
            const md = readCapped(path.join(workspaceRoot, resolved.spec));
            if (md === null) return base;
            const parsed = parseCapabilitySpec(md);
            return {
                ...base,
                available: true,
                ...(parsed.purpose ? { purpose: parsed.purpose } : {}),
                // Absent over empty: an empty list is omitted like every optional field.
                ...(parsed.requirements.length > 0 ? { requirements: parsed.requirements } : {}),
            };
        });

        return { ...view, capabilities };
    } catch {
        return view;
    }
}

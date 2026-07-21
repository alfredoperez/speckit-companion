import * as fs from 'fs';
import { LivingSpecsView, CapabilityContentView } from '../../core/types/specContext';
import { readLivingSpecs, isPathWithinRoot, ResolvedCapability } from '../specs/livingSpecsModel';

/** Cap on the feature spec read for delta counts — an oversized spec skips deltas. */
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
 * Resolve a names-only living-specs view to clickable run-log chips: each
 * capability gets a workspace-relative `specPath` when it resolves within the
 * workspace, so a chip can open it in the Living Specs viewer. The full content
 * lives there, not in the run log. Best-effort: an unresolved/out-of-root
 * capability stays `available: false`; any unexpected failure returns the view
 * unchanged so the panel falls back to the names-only list.
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
            if (!resolved || !resolved.spec || !resolved.exists || !isPathWithinRoot(workspaceRoot, resolved.spec)) {
                return base;
            }
            return { ...base, available: true, specPath: resolved.spec };
        });

        return { ...view, capabilities };
    } catch {
        return view;
    }
}

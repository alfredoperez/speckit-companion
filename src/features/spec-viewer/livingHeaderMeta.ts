/**
 * Capability facts for the living-spec viewer header.
 *
 * Coverage and drift are NOT derived here — they come from
 * `readCapabilityHealth`, the same call the Living Specs tree makes, so the two
 * surfaces can never disagree.
 */

import * as path from 'path';
import type { LivingHeaderMeta } from './types';
import {
    readLivingSpecs,
    readCapabilityHealth,
    requirementIds,
    CapabilityHealth,
} from '../specs/livingSpecsModel';

/** A numbered acceptance scenario as `/speckit.companion.living-adopt` writes it. */
const SCENARIO_LINE_RE = /^\s*\d+\.\s.*\bgiven\b.*\bwhen\b.*\bthen\b/i;

export interface LivingFactCounts {
    requirements?: number;
    scenarios?: number;
}

/** Document text with fenced code blocks removed. */
function withoutFences(content: string): string[] {
    const kept: string[] = [];
    let inFence = false;
    for (const line of content.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence) kept.push(line);
    }
    return kept;
}

/**
 * How many requirements and acceptance scenarios a living spec declares.
 * A count that comes out zero is returned absent — "none found" and "nothing
 * declared" must not render as a `0` the reader would trust.
 */
export function countLivingFacts(content: string): LivingFactCounts {
    if (!content) return {};

    const ids = requirementIds(content);
    const scenarios = withoutFences(content).filter(line => SCENARIO_LINE_RE.test(line)).length;

    const facts: LivingFactCounts = {};
    if (ids.length > 0) facts.requirements = ids.length;
    if (scenarios > 0) facts.scenarios = scenarios;
    return facts;
}

/**
 * The header's fact bundle for the capability that owns `specFilePath`, or
 * `null` when no configured capability claims it. Synchronous by design: it
 * reads only the config and the document already in hand, so the header can
 * render before the git-backed health call resolves.
 */
export function buildLivingHeaderMeta(
    workspaceRoot: string,
    specFilePath: string,
    content: string,
): LivingHeaderMeta | null {
    let listing;
    try {
        listing = readLivingSpecs(workspaceRoot, { withOrphans: false });
    } catch {
        return null;
    }
    if (!listing.enabled) return null;

    const rel = path.relative(workspaceRoot, specFilePath).replace(/\\/g, '/');
    const cap = listing.capabilities.find(c => c.spec === rel);
    if (!cap) return null;

    return {
        capabilityName: cap.name,
        specPath: cap.spec,
        location: cap.location,
        match: cap.match,
        ...countLivingFacts(content),
    };
}

/**
 * Coverage and drift for a capability, through the Living Specs tree's own
 * computation. Never rejects — a failure leaves both fields absent, which the
 * header renders as nothing rather than as a zero.
 */
export async function resolveLivingHealth(
    workspaceRoot: string,
    meta: LivingHeaderMeta,
): Promise<CapabilityHealth> {
    try {
        return await readCapabilityHealth(workspaceRoot, {
            name: meta.capabilityName,
            spec: meta.specPath,
            location: meta.location,
            exists: true,
            tiers: [],
            match: meta.match,
            exclude: [],
        });
    } catch {
        return {};
    }
}

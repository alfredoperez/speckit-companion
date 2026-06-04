/**
 * Provider registry — runtime validation for the static `PROVIDER_PATHS` blob.
 *
 * Each entry in `PROVIDER_PATHS` is a hand-written `ProviderPaths` record.
 * The TypeScript shape catches missing keys at compile time, but it can't
 * catch:
 *   - a `commandFormat` typo (`"dotted"` instead of `"dot"`)
 *   - an `autoApproveFlag` that drops its trailing space, silently
 *     concatenating into the next CLI argument (this is the historical
 *     failure mode behind the `feedback_provider_rename_breaks_settings`
 *     memory — see docs/refactor-plan.md)
 *   - an empty `displayName` that produces a blank QuickPick row
 *   - a malformed `quickPickIcon` that renders no icon
 *
 * This module exposes one entry point: `validateProviderConfig(type, config)`.
 * `aiProvider.ts` calls it on every `PROVIDER_PATHS` entry at module load.
 * Any violation throws at activation with the offending field named, so the
 * extension fails loudly with an actionable message instead of misbehaving
 * silently at first dispatch.
 */

import { AIProviderType, ProviderPaths } from './aiProvider';

export class ProviderRegistryError extends Error {
    constructor(type: AIProviderType, fieldErrors: string[]) {
        super(`Invalid provider config for "${type}": ${fieldErrors.join('; ')}`);
        this.name = 'ProviderRegistryError';
    }
}

const VALID_COMMAND_FORMATS = ['dot', 'dash'] as const;
const CODICON_RE = /^\$\([a-z0-9-]+\)$/;

/**
 * Validate a single provider config. Throws `ProviderRegistryError` listing
 * every failing field — we accumulate so one bad provider doesn't mask three
 * others. The returned config is the same object (validation is pure-check,
 * not mutation).
 */
export function validateProviderConfig(type: AIProviderType, config: ProviderPaths): ProviderPaths {
    const errors: string[] = [];

    if (!config.displayName || config.displayName.trim() === '') {
        errors.push('displayName must be a non-empty string');
    }

    if (!VALID_COMMAND_FORMATS.includes(config.commandFormat)) {
        errors.push(`commandFormat must be one of [${VALID_COMMAND_FORMATS.join(', ')}], got ${JSON.stringify(config.commandFormat)}`);
    }

    // `autoApproveFlag` is either empty (no flag) or a flag string that *must*
    // end with a trailing space so it concatenates cleanly with the next
    // argument. Missing the trailing space is the historical failure mode
    // that surfaced as "extension crashes activation" after a provider rename.
    if (config.autoApproveFlag !== '' && !config.autoApproveFlag.endsWith(' ')) {
        errors.push(`autoApproveFlag must be empty or end with a trailing space (got ${JSON.stringify(config.autoApproveFlag)})`);
    }

    // QuickPick icons must use the `$(codicon-name)` syntax or VS Code
    // silently renders nothing.
    if (config.quickPickIcon && !CODICON_RE.test(config.quickPickIcon)) {
        errors.push(`quickPickIcon must match \`$(codicon-name)\` (got ${JSON.stringify(config.quickPickIcon)})`);
    }

    // If a steering directory is declared, the pattern must be too — otherwise
    // glob enumeration silently returns nothing.
    if (config.steeringDir && !config.steeringPattern) {
        errors.push('steeringPattern must be non-empty when steeringDir is set');
    }

    if (errors.length > 0) {
        throw new ProviderRegistryError(type, errors);
    }

    return config;
}

/**
 * Validate every entry in a `PROVIDER_PATHS`-shaped record. Returns the same
 * record on success. Used at module load so misconfiguration trips the
 * extension on activation rather than at first dispatch.
 */
export function validateProviderRegistry(
    configs: Record<AIProviderType, ProviderPaths>,
): Record<AIProviderType, ProviderPaths> {
    for (const type of Object.keys(configs) as AIProviderType[]) {
        validateProviderConfig(type, configs[type]);
    }
    return configs;
}

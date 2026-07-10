"use strict";
/**
 * Manifest-backed phases subcommand router.
 * Keeps gsd-tools.cjs thin while preserving current CJS semantics.
 *
 * Unsupported in this router (treated as unknown):
 * - archive: `phases archive` is excluded from the subcommands list so it
 *   falls through to the unknown-subcommand error path.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/phases-command-router.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
const command_aliases_cjs_1 = require("./command-aliases.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cjsCommandRouterAdapter = require("./cjs-command-router-adapter.cjs");
const { routeCjsCommandFamily } = cjsCommandRouterAdapter;
// ─── Implementation ───────────────────────────────────────────────────────────
function routePhasesCommand({ phase, milestone, args, cwd, raw, error }) {
    routeCjsCommandFamily({
        args,
        // Exclude 'archive' so it hits the unknownMessage path.
        subcommands: command_aliases_cjs_1.PHASES_SUBCOMMANDS.filter((s) => s !== 'archive'),
        error,
        unknownMessage: (_subcommand, available) => `Unknown phases subcommand. Available: ${available.join(', ')}`,
        handlers: {
            list: () => {
                const typeIndex = args.indexOf('--type');
                const phaseIndex = args.indexOf('--phase');
                const options = {
                    type: typeIndex !== -1 ? args[typeIndex + 1] : null,
                    phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
                    includeArchived: args.includes('--include-archived'),
                };
                phase.cmdPhasesList(cwd, options, raw);
            },
            clear: () => milestone.cmdPhasesClear(cwd, raw, args.slice(2)),
        },
    });
}
module.exports = {
    routePhasesCommand,
};

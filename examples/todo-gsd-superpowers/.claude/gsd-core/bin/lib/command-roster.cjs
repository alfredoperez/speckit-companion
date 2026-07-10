'use strict';
/**
 * Command Roster Module
 *
 * Read-only helper for discovering canonical commands/gsd command stems and
 * applying the shared GSD slash-command namespace transform.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const slashCommandTransformer = require('../../../scripts/fix-slash-commands.cjs');
function readGsdCommandNames() {
    return slashCommandTransformer.readCmdNames();
}
module.exports = {
    readGsdCommandNames,
    transformContentToHyphen: slashCommandTransformer.transformContentToHyphen,
    transformContent: slashCommandTransformer.transformContent,
    buildPattern: slashCommandTransformer.buildPattern,
    buildColonPattern: slashCommandTransformer.buildColonPattern,
};

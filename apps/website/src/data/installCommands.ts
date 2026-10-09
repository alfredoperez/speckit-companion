// The install commands and links, shared by the launchpad and the three Install
// pages so one path cannot drift from another.

export const MARKETPLACE = 'https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion';

export const OPEN_IN_VSCODE = 'vscode:extension/alfredoperez.speckit-companion';

// The full --from URL form, verbatim. The short catalog form does not work,
// because the extension is not listed in the Spec Kit catalog.
export const COMPANION_COMMAND =
  'specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force';

// The stock PyPI specify-cli has no `extension` command; this build does.
export const SOURCE_CLI = 'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force';

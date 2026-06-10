import * as vscode from 'vscode';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';

/**
 * One-click install / update of the Companion **spec-kit CLI extension**.
 *
 * This is a spec-kit *CLI* extension (it ships the `/speckit.companion.*` command
 * family + the capture hooks), NOT a VS Code marketplace extension — so there is
 * no `vscode.extensions` install path. The only way to install it is to run the
 * `specify extension add` CLI in a terminal. Everything install-related lives here
 * so the URL/by-name swap and the prereq note have exactly one home.
 */

/** The published release asset. Install works TODAY against this `--from <url>` form. */
export const RELEASE_URL =
    'https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.3.0/companion-0.3.0.zip';

/**
 * The catalog by-name form. Resolves ONLY after github/spec-kit's catalog review
 * lists the extension (submission filed; ~3–7 days). Until then we install against
 * {@link RELEASE_URL}.
 *
 * TODO(catalog): once `companion` is listed in the spec-kit extension catalog,
 * flip {@link USE_BY_NAME_INSTALL} to `true` so the install action uses the by-name
 * form below instead of the release URL. This is the single switch to flip.
 */
export const BY_NAME_INSTALL = 'companion';

/**
 * Whether to install by catalog name instead of by release URL. Keep `false` until
 * the catalog lists the extension (see {@link BY_NAME_INSTALL}'s TODO).
 */
export const USE_BY_NAME_INSTALL = false;

/**
 * End-user prerequisite: the `extension` subcommand only exists on a github-source
 * spec-kit CLI. Stock PyPI `specify-cli` lacks it, so a plain `pip`/`uv` install of
 * `specify-cli` cannot run `specify extension add`. Surfaced alongside every install.
 */
export const CLI_PREREQ_COMMAND =
    'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force';

/** README section a banner's "Learn more" link falls back to when the user can't / won't install inline. */
export const README_FALLBACK_URL =
    'https://github.com/alfredoperez/speckit-companion#install-the-spec-kit-extension';

/**
 * Build the `specify extension add` command for the install/update action. `--force`
 * makes it an idempotent install-or-update. Uses the by-name form once the catalog
 * lists it (see {@link USE_BY_NAME_INSTALL}); the release URL form until then.
 */
export function buildInstallCommand(): string {
    if (USE_BY_NAME_INSTALL) {
        return `specify extension add ${BY_NAME_INSTALL} --force`;
    }
    return `specify extension add ${BY_NAME_INSTALL} --from ${RELEASE_URL} --force`;
}

/**
 * Pure gate for whether an install prompt (banner / affordance) should be shown:
 * the prompt mode is not `off` AND the extension is missing. Installed projects and
 * an explicit `off` always return `false` — no banner, no warning (zero-regression
 * acceptance). Mirrors the `activityPanel` `'off' | 'beta' | 'on'` precedent.
 */
export function shouldShowInstallPrompt(
    mode: 'off' | 'beta' | 'on',
    installed: boolean
): boolean {
    return mode !== 'off' && !installed;
}

/**
 * Resolve the install-prompt mode from VS Code settings. Defaults to `'on'`: this is
 * launch-critical safety guidance shown to everyone who is missing the extension, not
 * an experiment — `'off'` is the explicit opt-out.
 */
export function readInstallPromptMode(): 'off' | 'beta' | 'on' {
    return vscode.workspace
        .getConfiguration('speckit')
        .get<'off' | 'beta' | 'on'>('companion.installPrompt', 'on');
}

/**
 * Run the install/update in a VS Code integrated terminal. Echoes the github-source
 * CLI prereq as a comment first (so a user on stock PyPI `specify-cli` sees why
 * `specify extension add` might be missing), then runs the idempotent install. The
 * terminal is shown so the user sees progress and any prompts without leaving the editor.
 */
export function runInstallSpecKitExtension(workspaceRoot?: string): void {
    const terminal = vscode.window.createTerminal('Install spec-kit Extension');
    terminal.show();
    if (workspaceRoot) {
        terminal.sendText(`cd "${workspaceRoot}"`);
    }
    // Comment line: documents (does not auto-run) the prereq, then the actual install.
    terminal.sendText(`# Prerequisite (github-source spec-kit CLI): ${CLI_PREREQ_COMMAND}`);
    terminal.sendText(buildInstallCommand());
}

/** Workspace root of the first open folder, or undefined. */
function firstWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** True when the spec-kit extension is installed in the open project. Convenience over the raw primitive. */
export function isSpecKitExtensionInstalled(): boolean {
    const root = firstWorkspaceRoot();
    return root ? isCompanionInstalled(root) : false;
}

/** Open the README fallback link in the browser. */
export function openReadmeFallback(): void {
    void vscode.env.openExternal(vscode.Uri.parse(README_FALLBACK_URL));
}

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';
import { coerceLegacyBoolean } from '../core/settingsMigration';
import { ConfigKeys } from '../core/constants';
import { cachedCompanionGap, markInstallInFlight, readInstalledCompanionVersion, type CompanionGap } from './companionVersionGap';
import type { InstallPrompt } from '../protocol/viewer';

export type { InstallPrompt };

/**
 * One-click install / update of the Companion **spec-kit CLI extension**.
 *
 * This is a spec-kit *CLI* extension (it ships the `/speckit.companion.*` command
 * family + the capture hooks), NOT a VS Code marketplace extension — so there is
 * no `vscode.extensions` install path. The only way to install it is to run the
 * `specify extension add` CLI in a terminal. Everything install-related lives here
 * so the URL/by-name swap and the prereq note have exactly one home.
 */

/**
 * The stable rolling release asset. The `/publish-speckit-ext` flow refreshes this
 * fixed `companion-latest/companion.zip` URL on every release, so installing against
 * this `--from <url>` form always pulls the newest published build — no version
 * string, no per-release edit here. Both READMEs and the catalog `download_url` point
 * at the same asset.
 */
export const RELEASE_URL =
    'https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip';

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
 * Build the `specify extension add` command. Uses the by-name form once the catalog
 * lists it (see {@link USE_BY_NAME_INSTALL}); the release URL form until then.
 *
 * `extension add` refuses to overwrite an installed extension, so an update passes
 * `--force`. A fresh install must not: an older CLI rejected the flag outright
 * (issue #420), and a missing extension has nothing to overwrite.
 */
export function buildInstallCommand({ force = false }: { force?: boolean } = {}): string {
    const target = USE_BY_NAME_INSTALL ? BY_NAME_INSTALL : `${BY_NAME_INSTALL} --from ${RELEASE_URL}`;
    return `specify extension add ${target}${force ? ' --force' : ''}`;
}

/**
 * Pure gate for which install prompt (banner / affordance) a surface shows: the
 * prompt must be enabled, then a missing extension asks to install and an
 * out-of-date one asks to update. Current installs and an explicit opt-out
 * (`enabled === false`) always return `null` — no banner, no warning.
 */
export function shouldShowInstallPrompt(enabled: boolean, gap: CompanionGap): InstallPrompt | null {
    if (!enabled) {
        return null;
    }
    if (gap.state === 'missing') {
        return { kind: 'install' };
    }
    if (gap.state === 'outdated') {
        return { kind: 'update', installed: gap.installed, expected: gap.expected };
    }
    return null;
}

/** The install banner has one permanent flag; the update banner is dismissed per expected version so the next release asks again. */
function dismissalFor(prompt: InstallPrompt | undefined): { key: string; value: string | boolean } {
    // A version-skewed webview can post a bare message; treat it as the install banner rather than throwing into the host log.
    return prompt?.kind === 'update'
        ? { key: ConfigKeys.globalState.companionUpdateSkippedVersion, value: prompt.expected }
        : { key: ConfigKeys.globalState.installBannerDismissed, value: true };
}

export function isInstallPromptDismissed(globalState: vscode.Memento, prompt: InstallPrompt): boolean {
    const { key, value } = dismissalFor(prompt);
    return globalState.get<unknown>(key) === value;
}

const dismissed = new vscode.EventEmitter<void>();

/** Fires when a prompt is silenced, so the ambient surfaces (status bar, badge) re-sync without waiting for a file to change. */
export const onDidDismissInstallPrompt = dismissed.event;

/** Persist the dismissal of the prompt the user closed, as the banner reported it. The one write path for every dismissal. */
export async function dismissInstallPrompt(context: vscode.ExtensionContext, prompt: InstallPrompt | undefined): Promise<void> {
    const { key, value } = dismissalFor(prompt);
    await context.globalState.update(key, value);
    dismissed.fire();
}

/** The prompt a banner surface renders right now — setting, on-disk versions and dismissal all resolved — or `null` for nothing. */
export function resolveInstallPrompt(context: vscode.ExtensionContext, workspaceRoot = firstWorkspaceRoot()): InstallPrompt | null {
    const gap = workspaceRoot ? cachedCompanionGap(workspaceRoot, context.extensionPath) : { state: 'missing' as const };
    if (updateAlreadyAttempted(context, gap)) {
        return null;
    }
    const prompt = shouldShowInstallPrompt(readInstallPromptEnabled(), gap);
    return prompt && !isInstallPromptDismissed(context.globalState, prompt) ? prompt : null;
}

/**
 * Resolve whether the install prompt is enabled — gated only on its own
 * `speckit.companion.installPrompt` preference (default `true`). The extension is
 * what powers the Companion workflow, so the prompt to install it reaches everyone
 * who doesn't have it yet. The read tolerates a legacy tri-state string until
 * migration rewrites it. Whether the banner actually shows is `resolveInstallPrompt`.
 */
const execAsync = promisify(exec);

let forceProbe: Promise<boolean> | undefined;

/**
 * Does this machine's `specify extension add` accept `--force`? An older CLI errors out on the flag
 * ("No such option '--force'", issue #420), and that is the cohort every out-of-date surface targets, so
 * asking before using it is the difference between an update and a hard error nothing recovers from.
 * Probed once per session; an unreadable probe assumes the documented current CLI, which needs the flag.
 */
export function specifySupportsForce(): Promise<boolean> {
    forceProbe ??= execAsync('specify extension add --help')
        .then(({ stdout, stderr }) => `${stdout}${stderr}`.includes('--force'))
        .catch(() => true);
    return forceProbe;
}

/** Forget the probe result. Test-only — never called in production. */
export function __resetForceProbe(): void {
    forceProbe = undefined;
}

export function readInstallPromptEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('speckit');
    return coerceLegacyBoolean(config.get<unknown>('companion.installPrompt', true), true);
}

/**
 * Run the install/update in a VS Code integrated terminal. Echoes the github-source
 * CLI prereq as a comment first (so a user on stock PyPI `specify-cli` sees why
 * `specify extension add` might be missing), then runs the idempotent install. The
 * terminal is shown so the user sees progress and any prompts without leaving the editor.
 */
export async function runInstallSpecKitExtension(workspaceRoot?: string): Promise<void> {
    // Set the working directory via the terminal options' `cwd` rather than emitting a
    // `cd "${workspaceRoot}"` command. A workspace path containing `"`, `` ` ``, `$`, or
    // `\` could otherwise break out of the quoting and inject shell — VS Code handles the
    // path as a structured value here, so it is never interpolated into a command string.
    const terminal = vscode.window.createTerminal({
        name: 'Install spec-kit Extension',
        ...(workspaceRoot ? { cwd: workspaceRoot } : {}),
    });
    terminal.show();
    // Print (do NOT run) the prereq via echo, then run the actual install. A raw `#`
    // comment line is unreliable: interactive zsh has INTERACTIVE_COMMENTS off by
    // default, so a leading `#` would be executed and error ("command not found: #")
    // instead of being treated as a comment. echo is portable across bash/zsh.
    terminal.sendText(`echo "Prerequisite (github-source spec-kit CLI): ${CLI_PREREQ_COMMAND}"`);
    // `extension add` refuses when the spec-kit registry lists the extension, which can outlive the directory
    // (a deleted dir, a dropped `--dev` symlink, a half-finished install), so either signal means force.
    const alreadyThere = !!workspaceRoot && (isCompanionInstalled(workspaceRoot) || readInstalledCompanionVersion(workspaceRoot) !== undefined);
    markInstallInFlight();
    terminal.sendText(buildInstallCommand({ force: alreadyThere && (await specifySupportsForce()) }));
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

/** The `installed→expected` pair an update was last dispatched for, so a re-offer of the same pair is recognisable. */
function attemptId(gap: CompanionGap & { state: 'outdated' }): string {
    return `${gap.installed}->${gap.expected}`;
}

/** Record that an update was dispatched for the gap on screen. Called when the user triggers the install. */
export async function recordUpdateAttempt(context: vscode.ExtensionContext, gap: CompanionGap): Promise<void> {
    if (gap.state === 'outdated') {
        await context.globalState.update(ConfigKeys.globalState.companionUpdateAttempted, attemptId(gap));
    }
}

/**
 * True when this exact gap was already updated for and nothing moved — the published extension is not
 * actually newer than what is installed, so the update cannot succeed and no surface should keep asking.
 */
export function updateAlreadyAttempted(context: vscode.ExtensionContext, gap: CompanionGap): boolean {
    return (
        gap.state === 'outdated' &&
        context.globalState.get<string>(ConfigKeys.globalState.companionUpdateAttempted) === attemptId(gap)
    );
}

/** Open the README fallback link in the browser. */
export function openReadmeFallback(): void {
    void vscode.env.openExternal(vscode.Uri.parse(README_FALLBACK_URL));
}

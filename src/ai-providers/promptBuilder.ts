import * as vscode from 'vscode';
import * as path from 'path';
import {
    PromptStep,
    MARKER_CLOSE,
    isKnownStep,
    renderPreamble,
    renderLifecyclePreamble,
    renderSpecifyCreationLifecyclePreamble,
    WORKSPACE_WRITER_PATH,
} from './promptPreamble';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';

export type { PromptStep } from './promptPreamble';

export interface BuildPromptOptions {
    command: string;
    step?: string | null;
    specDir?: string | null;
}

function isContextInstructionsEnabled(): boolean {
    try {
        return vscode.workspace
            .getConfiguration('speckit')
            .get<boolean>('aiContextInstructions', true);
    } catch {
        return true;
    }
}

function nowUtc(): string {
    return new Date().toISOString();
}

/**
 * Whether a companion `/speckit.companion.*` command will close `specify` itself
 * (via its `write-context.py --kind complete` call). When false, the AI must
 * self-close specify or it sticks at `specifying` (#332). A companion command
 * existing implies the extension is installed, so the command verb is the signal.
 */
function companionRecordsSteps(command: string): boolean {
    // Test the command VERB only (first token), not the args — a stock command
    // whose argument path contains "companion" must not be misread as companion.
    const verb = command.trim().split(/\s+/, 1)[0] ?? '';
    return /companion/i.test(verb);
}

/** Companion extension present in the current workspace (for the create flow, which has no command verb yet). */
function companionInstalledHere(): boolean {
    try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return !!root && isCompanionInstalled(root);
    } catch {
        return false;
    }
}

/**
 * Absolute path to the context writer bundled inside this extension — the copy
 * every stock-mode preamble references, so capture works without the workspace
 * spec-kit extension. Falls back to the workspace-relative companion path only
 * when the extension can't resolve its own install dir.
 */
export function bundledWriterPath(): string {
    try {
        const ext = vscode.extensions.getExtension('alfredoperez.speckit-companion');
        if (ext?.extensionPath) {
            return path.join(ext.extensionPath, 'speckit-extension', 'scripts', 'write-context.py');
        }
    } catch {
        // fall through to the workspace fallback
    }
    return WORKSPACE_WRITER_PATH;
}

export function buildPrompt(options: BuildPromptOptions): string {
    const { command, step, specDir } = options;
    if (!isContextInstructionsEnabled()) return command;
    if (!isKnownStep(step)) return command;
    const preamble = renderPreamble(step as PromptStep, specDir ?? '', nowUtc(), companionRecordsSteps(command), bundledWriterPath());
    return `${preamble}\n\n${command}`;
}

/**
 * Build a prompt for multi-step commands that covers
 * the entire step lifecycle rather than a single step.
 */
export function buildLifecyclePrompt(command: string, specDir?: string | null): string {
    if (!isContextInstructionsEnabled()) return command;
    const preamble = renderLifecyclePreamble(specDir ?? '', nowUtc(), companionRecordsSteps(command), bundledWriterPath());
    return `${preamble}\n\n${command}`;
}

/**
 * Build the preamble for the spec editor's "Create" dispatch. The spec dir
 * does not yet exist, so the preamble includes both the initial-creation
 * fields and the lifecycle "throughout this run, for EACH step…" body —
 * the latter survives in CLI chat history when the user keeps typing
 * follow-up commands in the same terminal session.
 *
 * Returns just the preamble (no command wrapper) because the spec editor
 * appends it to a temp markdown file separately from the dispatched command.
 *
 * The chosen workflow name is seeded verbatim into `.spec-context.json` so every
 * step dispatches that workflow's command family.
 */
export function buildSpecifyCreationPreamble(
    workflowName: string,
    specDir?: string | null
): string {
    if (!isContextInstructionsEnabled()) return '';
    // specify is self-recorded only when the companion workflow runs AND its
    // extension is installed; otherwise the AI must close specify itself (#332).
    const companionRecords = workflowName === 'companion' && companionInstalledHere();
    return renderSpecifyCreationLifecyclePreamble(workflowName, specDir ?? null, nowUtc(), companionRecords, bundledWriterPath());
}

/**
 * Split a built prompt into its context-update preamble and the clean command
 * (typically just a slash command). When no preamble marker is present, the
 * whole prompt is returned as `command`. Used by providers that must route the
 * bookkeeping preamble separately from the user-facing command (Claude via
 * `--append-system-prompt`) or drop it entirely (IDE Chat, whose host editor
 * can't act on it).
 */
export function splitContextPreamble(prompt: string): { preamble: string | null; command: string } {
    const idx = prompt.indexOf(MARKER_CLOSE);
    if (idx === -1) {
        return { preamble: null, command: prompt };
    }
    const end = idx + MARKER_CLOSE.length;
    return {
        preamble: prompt.slice(0, end).trim(),
        command: prompt.slice(end).trim(),
    };
}

/**
 * Read a specify temp markdown file and return the feature description, dropping
 * the bookkeeping the extension appends below it (`## Post-Specification`).
 * Returns null when the file can't be read or is empty. Shared by providers that
 * inline the description into a prefilled command instead of passing the temp
 * path a human-facing surface can't open (IDE chat, Claude panel).
 */
export async function readSpecDescription(filePath: string): Promise<string | null> {
    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const text = Buffer.from(data).toString('utf-8');
        const marker = text.indexOf('## Post-Specification');
        const body = (marker === -1 ? text : text.slice(0, marker)).trim();
        return body || null;
    } catch {
        return null;
    }
}

/** The spec name from a path: the last segment, or its parent when it's a doc file. */
export function specNameFromPath(p: string): string {
    const segments = p.split(/[/\\]/).filter(Boolean);
    let name = segments.pop() ?? p;
    if (/\.md$/i.test(name) && segments.length > 0) {
        name = segments.pop()!;
    }
    return name;
}

/**
 * Clean the argument of an already-verb-formatted `/speckit.* <arg>` command for
 * dispatch to a surface that prefills text a human reads (IDE chat, Claude panel):
 * - free-text / multi-token / non-path args are kept as-is;
 * - `specify <temp.md>` (create-new-spec writes the description into a temp md the
 *   surface can't open) is inlined to `specify <description>`;
 * - any other spec-dir path arg is shortened to just the spec name.
 *
 * The command verb is left untouched — callers apply dot/dash formatting first.
 */
export async function cleanCommandArg(command: string): Promise<string> {
    const trimmed = command.trim();
    const sp = trimmed.indexOf(' ');
    if (sp === -1) return trimmed;
    const cmd = trimmed.slice(0, sp);
    const arg = trimmed.slice(sp + 1).trim();
    if (!arg) return cmd;

    if (/\s/.test(arg)) return `${cmd} ${arg}`;     // free-text / multi-token argument
    if (!/[/\\]/.test(arg)) return `${cmd} ${arg}`; // not a path

    if (/[.-]specify$/.test(cmd) && /\.md$/i.test(arg)) {
        const description = await readSpecDescription(arg);
        if (description) return `${cmd} ${description}`;
    }
    return `${cmd} ${specNameFromPath(arg)}`;
}

/**
 * Rewrite markdown image references from their source (globalStorage) paths to
 * staged in-workspace paths. A pure ref-swap: for OpenCode, whose sandbox rejects
 * reads outside the project root, after images are copied into a self-gitignored
 * workspace cache dir, the inlined spec body's `![…](<sourcePath>)` links must
 * point at the staged copies so the agent reads an in-project path.
 *
 * `mapping` is { sourceFsPath → stagedFsPath }. Each `](<sourcePath>)` occurrence
 * is replaced with `](<stagedPath>)`. A body with no matching link is returned
 * unchanged, and an empty mapping is a no-op — so the caller can pass whatever it
 * staged and rely on this to touch only the references it actually moved.
 */
export function rewriteImageRefsToStaged(
    body: string,
    mapping: Record<string, string>
): string {
    let out = body;
    for (const [source, staged] of Object.entries(mapping)) {
        if (!source || source === staged) {
            continue;
        }
        // Replace only inside a markdown image/link target `](<source>)` to avoid
        // rewriting an incidental occurrence of the path elsewhere in prose.
        out = out.split(`](${source})`).join(`](${staged})`);
    }
    return out;
}

/**
 * Inline a `/speckit.* specify <temp.md>` dispatch so the agent never has to
 * read the file: replace the path argument with the *full* file contents
 * (description + the appended capture bookkeeping), newline-separated. Unlike
 * `cleanCommandArg` — which strips bookkeeping for human-facing chat surfaces —
 * this preserves everything a terminal agent would have read from the file.
 *
 * For sandboxed CLIs (OpenCode) that refuse to read paths outside the project
 * directory, where the spec-editor stages its temp file. The path may contain
 * spaces (e.g. macOS `Application Support`), so the whole argument is treated
 * as the path and the read itself is the validation. Any prompt that isn't a
 * `specify` command pointing at a readable `.md` path is returned unchanged.
 */
export async function inlineSpecifyTempPath(prompt: string): Promise<string> {
    const { preamble, command } = splitContextPreamble(prompt);
    const trimmed = command.trim();
    const sp = trimmed.indexOf(' ');
    if (sp === -1) return prompt;
    const cmd = trimmed.slice(0, sp);
    const arg = trimmed.slice(sp + 1).trim();
    if (!/[.-]specify$/.test(cmd) || !/\.md$/i.test(arg) || !/[/\\]/.test(arg)) return prompt;

    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(arg));
        const body = Buffer.from(data).toString('utf-8').trim();
        if (!body) return prompt;
        const inlined = `${cmd}\n\n${body}`;
        return preamble ? `${preamble}\n\n${inlined}` : inlined;
    } catch {
        return prompt;
    }
}

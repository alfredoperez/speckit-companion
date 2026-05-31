/**
 * SpecKit Companion - Message Handlers
 * Handles messages from the webview
 */

import * as path from "path";
import * as vscode from "vscode";
import { formatCommandForProvider } from "../../ai-providers/aiProvider";
import {
  buildLifecyclePrompt,
  buildPrompt,
} from "../../ai-providers/promptBuilder";
import {
  ConfigKeys,
  FooterActionIds,
  SpecStatuses,
} from "../../core/constants";
import type { CustomCommandConfig } from "../../core/types/config";
import type { SpecContext, StepName } from "../../core/types/specContext";
import { NotificationUtils } from "../../core/utils/notificationUtils";
import { createDispatcher, DispatcherMap } from "../../core/utils/dispatcher";
import {
  SPEC_CONTEXT_FILENAME,
  readSpecContext,
  readSpecContextSync,
} from "../specs/specContextReader";
import { updateSpecContext } from "../specs/specContextWriter";
import { lastEntryIsCompletionFor } from "../specs/historyHelpers";
import {
  completeStep,
  reactivate,
  setStatus,
  startStep,
} from "../specs/stepLifecycle";
import { getFeatureWorkflow, getWorkflowCommands } from "../workflows";
import type { FeatureWorkflowContext, WorkflowStepConfig } from "../workflows/types";
import { isOptionalCommand } from "./optionalCommands";
import {
  addComment as addCommentToCtx,
  buildReviewComment,
  markApplied,
  pendingForDoc,
  removeComment as removeCommentFromCtx,
} from "./reviewComments";
import { findRunningStep } from "./stateDerivation";
import { deriveStepHistory } from "../specs/stepHistoryDerivation";
import type { CoreDocumentType } from "./types";
import type { ReviewCommentDoc } from "../../core/types/specContext";
import {
  DocumentType,
  SpecViewerState,
  ViewerToExtensionMessage,
} from "./types";

/**
 * Interface for message handler dependencies
 */
export interface MessageHandlerDependencies {
  getInstance: (
    specDirectory: string,
  ) =>
    | { state: SpecViewerState; debounceTimer: NodeJS.Timeout | undefined }
    | undefined;
  updateContent: (
    specDirectory: string,
    documentType: DocumentType,
  ) => Promise<void>;
  sendContentUpdateMessage: (
    specDirectory: string,
    documentType: DocumentType,
  ) => Promise<void>;
  refreshContextIfDisplaying: (specContextPath: string) => Promise<void>;
  resolveWorkflowSteps: (
    specDirectory: string,
  ) => Promise<WorkflowStepConfig[]>;
  executeInTerminal: (prompt: string) => Promise<void>;
  outputChannel: vscode.OutputChannel;
  context: vscode.ExtensionContext;
}

/**
 * The handler map is built on top of the generic `createDispatcher` utility
 * in `core/utils/dispatcher.ts` — same pattern (exhaustive `{ [K in U['type']]: Handler<K> }`
 * over a discriminated union), just lifted so workflow-editor and future
 * webview surfaces can reuse it without re-deriving the type plumbing.
 */

/**
 * Footer-action sub-dispatch. Same shape as the top-level map: every
 * `FooterActionIds.*` either maps to a handler or it's an unknown id.
 */
const FOOTER_ACTION_HANDLERS: Record<
  string,
  (specDirectory: string, deps: MessageHandlerDependencies) => Promise<void>
> = {
  [FooterActionIds.ARCHIVE]: (dir, deps) => handleLifecycleAction(dir, SpecStatuses.ARCHIVED, deps),
  [FooterActionIds.REACTIVATE]: (dir, deps) => handleLifecycleAction(dir, SpecStatuses.ACTIVE, deps),
  [FooterActionIds.COMPLETE]: (dir, deps) => handleLifecycleAction(dir, SpecStatuses.COMPLETED, deps),
  [FooterActionIds.REGENERATE]: (dir, deps) => handleRegenerate(dir, deps),
  [FooterActionIds.APPROVE]: (dir, deps) => handleApprove(dir, deps),
  [FooterActionIds.START]: (dir, deps) => handleApprove(dir, deps),
  [FooterActionIds.SDD_AUTO]: (dir, deps) => handleClarify(dir, deps, "/sdd:auto"),
};

/**
 * Build the per-message dispatch map for a panel. Each entry is a thin
 * adapter that unpacks the typed message payload and invokes the handler.
 * Adding a new message type fails the build until an adapter is added —
 * that's the whole point of `DispatcherMap`'s indexed-access type.
 */
function buildHandlerMap(): DispatcherMap<ViewerToExtensionMessage, [string, MessageHandlerDependencies]> {
  return {
    switchDocument: (msg, dir, deps) => handleSwitchDocument(dir, msg.documentType, deps),
    editDocument: (_msg, dir, deps) => handleEditDocument(dir, deps),
    editSource: (_msg, dir, deps) => handleEditDocument(dir, deps),
    refreshContent: (_msg, dir, deps) => handleRefresh(dir, deps),
    ready: async (_msg, dir, deps) => {
      deps.outputChannel.appendLine("[SpecViewer] Webview ready");
      // Push viewerState (incl. transitions) — initial HTML hydrates navState
      // and markdown, but viewerState only flows via message.
      await deps.refreshContextIfDisplaying(path.join(dir, SPEC_CONTEXT_FILENAME));
    },
    stepperClick: (msg, dir, deps) => handleStepperClick(dir, msg.phase, deps),
    regenerate: (_msg, dir, deps) => handleRegenerate(dir, deps),
    approve: (_msg, dir, deps) => handleApprove(dir, deps),
    markStepComplete: (_msg, dir, deps) => handleMarkStepComplete(dir, deps),
    clarify: (msg, dir, deps) => handleClarify(dir, deps, msg.command),
    refineLine: (msg, dir, deps) => handleRefineLine(dir, msg.lineNum, msg.content, msg.instruction, deps),
    editLine: (msg, dir, deps) => handleEditLine(dir, msg.lineNum, msg.newText, deps),
    removeLine: (msg, dir, deps) => handleRemoveLine(dir, msg.lineNum, deps),
    toggleCheckbox: (msg, dir, deps) => handleToggleCheckbox(dir, msg.lineNum, msg.checked, deps),
    addComment: (msg, dir, deps) =>
      handleAddComment(dir, msg.id, msg.doc, msg.lineNum, msg.lineContent, msg.comment, deps),
    removeComment: (msg, dir, deps) => handleRemoveComment(dir, msg.id, deps),
    runDocRefinement: (msg, dir, deps) => dispatchDocRefinement(dir, msg.doc, deps),
    completeSpec: (_msg, dir, deps) => handleLifecycleAction(dir, SpecStatuses.COMPLETED, deps),
    archiveSpec: (_msg, dir, deps) => handleLifecycleAction(dir, SpecStatuses.ARCHIVED, deps),
    reactivateSpec: (_msg, dir, deps) => handleLifecycleAction(dir, SpecStatuses.ACTIVE, deps),
    openFile: (msg, _dir, deps) => handleOpenFile(msg.filename, deps),
    webviewError: async (msg, _dir, deps) => {
      deps.outputChannel.appendLine(
        `[SpecViewer] Webview error (${msg.source}): ${msg.message}` +
          (msg.stack ? `\n${msg.stack}` : ""),
      );
    },
    footerAction: async (msg, dir, deps) => {
      const fn = FOOTER_ACTION_HANDLERS[msg.id];
      if (fn) await fn(dir, deps);
      else deps.outputChannel.appendLine(`[SpecViewer] Unknown footerAction id: ${msg.id}`);
    },
  };
}

/**
 * Create message handlers for a spec directory.
 *
 * The previous implementation was a 140-line switch ladder with manual
 * field extraction at every case. It's now a typed dispatch map (see
 * `buildHandlerMap`) — TypeScript verifies exhaustiveness at compile time
 * and a single 3-line dispatcher routes every variant to its adapter.
 */
export function createMessageHandlers(
  specDirectory: string,
  deps: MessageHandlerDependencies,
) {
  const dispatch = createDispatcher(buildHandlerMap());
  return async (message: ViewerToExtensionMessage) => {
    deps.outputChannel.appendLine(`[SpecViewer] Received message: ${message.type}`);
    await dispatch(message, specDirectory, deps);
  };
}

/**
 * Handle document switch request
 */
async function handleSwitchDocument(
  specDirectory: string,
  documentType: DocumentType,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  // Debounce rapid clicks
  if (instance.debounceTimer) {
    clearTimeout(instance.debounceTimer);
  }

  instance.debounceTimer = setTimeout(async () => {
    // Use message-based update for smoother transition (no page flash)
    await deps.sendContentUpdateMessage(specDirectory, documentType);
  }, 50);
}

/**
 * Handle edit document request
 */
async function handleEditDocument(
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const currentDoc = instance.state.availableDocuments.find(
    (d) => d.type === instance.state.currentDocument,
  );

  if (!currentDoc || !currentDoc.exists) {
    vscode.window.showWarningMessage("Cannot edit: document not found");
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(currentDoc.filePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    deps.outputChannel.appendLine(
      `[SpecViewer] Opened for editing: ${currentDoc.filePath}`,
    );
  } catch (error) {
    deps.outputChannel.appendLine(
      `[SpecViewer] Error opening document: ${error}`,
    );
    vscode.window.showErrorMessage(`Failed to open document: ${error}`);
  }
}

/**
 * Handle refresh request
 */
async function handleRefresh(
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;
  await deps.updateContent(
    instance.state.specDirectory,
    instance.state.currentDocument,
  );
}

/**
 * Handle stepper click - navigate to phase document
 */
async function handleStepperClick(
  specDirectory: string,
  phase: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  if (phase === "done") return; // Done is not clickable

  // Full regeneration — matches sidebar navigation's appearance.
  await deps.updateContent(specDirectory, phase);
}

/**
 * Handle regenerate request
 */
async function handleRegenerate(
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  // Regenerate targets the spec's actual current step, not the viewed
  // tab. Clicking regenerate while on a child doc (data-model.md,
  // research.md) would otherwise no-op or write a start entry for the
  // wrong step.
  const ctx = readSpecContextSync(specDirectory);
  const targetStepName = ctx?.currentStep;
  const steps = await deps.resolveWorkflowSteps(specDirectory);
  const stepDef = targetStepName
    ? steps.find((s) => s.name === targetStepName)
    : undefined;

  if (stepDef && targetStepName) {
    if (isLifecycleStep(targetStepName)) {
      await startStep(specDirectory, targetStepName, "extension");
    }
    await deps.updateContent(specDirectory, instance.state.currentDocument);
    await executeStepInTerminal(stepDef, specDirectory, deps);
  }
}

const LIFECYCLE_STEP_NAMES: ReadonlySet<string> = new Set([
  "specify",
  "clarify",
  "plan",
  "tasks",
  "analyze",
  "implement",
]);

function isLifecycleStep(name: string): boolean {
  return LIFECYCLE_STEP_NAMES.has(name);
}

/**
 * Handle approve request - generate next phase or implement tasks
 */
async function handleApprove(
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const ctx = readSpecContextSync(specDirectory);
  const steps = await deps.resolveWorkflowSteps(specDirectory);
  const navSteps = steps.filter((s) => !s.actionOnly);

  // Dispatch routes off ctx.currentStep so a past stepper tab can't
  // misdirect the action. Fall back to docType only when currentStep
  // isn't a navStep (e.g. the actionOnly implement step).
  let currentIndex = ctx?.currentStep
    ? navSteps.findIndex((s) => s.name === ctx.currentStep)
    : -1;
  if (currentIndex < 0) {
    const docType = instance.state.currentDocument;
    currentIndex = navSteps.findIndex((s) => s.name === docType);
    if (currentIndex < 0) {
      const relatedDoc = instance.state.availableDocuments.find(
        (d) => d.type === docType && d.category === "related",
      );
      if (relatedDoc?.parentStep) {
        currentIndex = navSteps.findIndex(
          (s) => s.name === relatedDoc.parentStep,
        );
      }
    }
  }

  const targetStep = ctx?.currentStep;
  if (targetStep && isLifecycleStep(targetStep)) {
    const alreadyComplete = lastEntryIsCompletionFor(
      ctx?.history ?? [],
      targetStep,
    );
    if (!alreadyComplete) {
      await completeStep(specDirectory, targetStep, "extension");
    }
  }

  if (currentIndex >= 0 && currentIndex < navSteps.length - 1) {
    // Execute next step's command
    const nextStep = navSteps[currentIndex + 1];
    if (isLifecycleStep(nextStep.name)) {
      await startStep(specDirectory, nextStep.name as StepName, "extension");
    }
    await deps.updateContent(specDirectory, instance.state.currentDocument);
    await executeStepInTerminal(nextStep, specDirectory, deps);
  } else if (currentIndex === navSteps.length - 1) {
    // Last navigable step: find the actionOnly implement step
    const implementStep = steps.find((s) => s.actionOnly);
    if (implementStep) {
      if (isLifecycleStep(implementStep.name)) {
        await startStep(
          specDirectory,
          implementStep.name as StepName,
          "extension",
        );
      }
      await deps.updateContent(specDirectory, instance.state.currentDocument);
      await executeStepInTerminal(implementStep, specDirectory, deps);
    }
  }
}

/**
 * Spec 099: manual completion fallback. Resolves the running step (startedAt,
 * no completedAt) and marks it complete, then refreshes the viewer. Lets the
 * user advance the footer when content-aware auto-detection never fires (e.g.
 * the AI failed silently).
 */
async function handleMarkStepComplete(
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  let ctx: SpecContext | null = null;
  try {
    ctx = await readSpecContext(specDirectory);
  } catch (err) {
    deps.outputChannel.appendLine(
      `[SpecViewer] markStepComplete: readSpecContext failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const derived = ctx
    ? deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
    : undefined;
  const running = findRunningStep(derived)?.step ?? null;

  if (!running || !isLifecycleStep(running)) {
    deps.outputChannel.appendLine(
      "[SpecViewer] markStepComplete: no running step to complete",
    );
    return;
  }

  deps.outputChannel.appendLine(
    `[SpecViewer] markStepComplete: completing "${running}"`,
  );
  await completeStep(specDirectory, running as StepName, "extension");
  await deps.updateContent(specDirectory, instance.state.currentDocument);
}

/**
 * Execute a workflow step command in a VS Code terminal.
 * Uses changeRoot (if available) as the path argument so commands receive
 * the change root, not the nested spec dir.
 */
async function executeStepInTerminal(
  step: WorkflowStepConfig,
  specDirectory: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  const targetPath = instance?.state.changeRoot || specDirectory;
  const label = step.label || step.name;
  const formatted = formatCommandForProvider(step.command);
  const rawPrompt = `/${formatted} ${targetPath}`;
  const prompt = buildPrompt({
    command: rawPrompt,
    step: step.name,
    specDir: targetPath,
  });
  deps.outputChannel.appendLine(
    `[SpecViewer] Executing step "${label}": ${rawPrompt}`,
  );
  await deps.executeInTerminal(prompt);
}

/**
 * Handle lifecycle action (complete or archive a spec)
 */
async function handleLifecycleAction(
  specDirectory: string,
  status:
    | typeof SpecStatuses.COMPLETED
    | typeof SpecStatuses.ARCHIVED
    | typeof SpecStatuses.ACTIVE,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const label = status === SpecStatuses.ACTIVE ? "reactivated" : status;
  deps.outputChannel.appendLine(
    `[SpecViewer] Setting spec status to ${status}: ${specDirectory}`,
  );

  if (status === SpecStatuses.ACTIVE) {
    await reactivate(specDirectory);
  } else {
    await setStatus(specDirectory, status as "completed" | "archived");
  }
  await vscode.commands.executeCommand("speckit.refresh");
  await deps.updateContent(specDirectory, instance.state.currentDocument);

  NotificationUtils.showAutoDismissNotification(
    `Spec "${instance.state.specName}" marked as ${label}`,
  );
}

/**
 * Handle clarify/enhancement button - executes the matching customCommand in the AI terminal
 */
/**
 * A normalised enhancement command pulled from either `customCommands`
 * (settings) or `getWorkflowCommands` (workflow YAML). Both sources used to
 * be walked through near-identical for-loops with the same matcher and the
 * same dispatch builder — now they unify behind this shape.
 */
interface EnhancementCommand {
  command: string;
  step?: string;
  title?: string;
  name?: string;
}

function customCommandsFromConfig(): EnhancementCommand[] {
  const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
  const raw = config.get<Array<CustomCommandConfig | string>>("customCommands", []);
  const out: EnhancementCommand[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") continue;
    const command = entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
    if (!command) continue;
    out.push({ command, step: entry.step, title: entry.title, name: entry.name });
  }
  return out;
}

/**
 * Test whether a candidate command matches the current dispatch intent.
 * When the user clicked a specific button (`buttonCommand` set), the
 * candidate's command must match exactly. When the dispatch is implicit
 * ("clarify the current step"), match by step with `"all"` as wildcard.
 */
function matchesCommand(
  candidate: EnhancementCommand,
  buttonCommand: string | undefined,
  docType: string,
): boolean {
  if (buttonCommand) return candidate.command === buttonCommand;
  const step = candidate.step || "all";
  return step === docType || step === "all";
}

async function dispatchEnhancement(
  command: EnhancementCommand,
  source: "enhancement" | "workflow",
  targetPath: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const label = command.title || command.name || "Enhancement";
  const rawPrompt = `${command.command} "${targetPath}"`;
  const isMultiStep = command.command.includes(":auto");
  const prompt = isMultiStep ? buildLifecyclePrompt(rawPrompt, targetPath) : rawPrompt;
  deps.outputChannel.appendLine(
    `[SpecViewer] Executing ${source} command "${label}": ${rawPrompt}`,
  );
  await deps.executeInTerminal(prompt);
}

async function handleClarify(
  specDirectory: string,
  deps: MessageHandlerDependencies,
  buttonCommand?: string,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const docType = instance.state.currentDocument;
  const targetPath = instance.state.changeRoot || specDirectory;

  // Source 1: custom commands from settings.
  for (const cmd of customCommandsFromConfig()) {
    if (matchesCommand(cmd, buttonCommand, docType)) {
      await dispatchEnhancement(cmd, "enhancement", targetPath, deps);
      return;
    }
  }

  // Source 2: workflow-defined commands. Tolerate transient read failures —
  // the dispatch should not crash if .spec-context.json is briefly
  // unreadable (e.g., mid-write by the AI CLI).
  let featureCtx: FeatureWorkflowContext | undefined;
  try {
    featureCtx = await getFeatureWorkflow(specDirectory, instance.state.changeRoot);
  } catch (err) {
    deps.outputChannel.appendLine(
      `[SpecViewer] handleClarify: getFeatureWorkflow failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (featureCtx?.workflow) {
    for (const wfCmd of getWorkflowCommands(featureCtx.workflow)) {
      if (!wfCmd.command) continue;
      const cmd: EnhancementCommand = {
        command: wfCmd.command,
        step: wfCmd.step,
        title: wfCmd.title,
        name: wfCmd.name,
      };
      if (matchesCommand(cmd, buttonCommand, docType)) {
        await dispatchEnhancement(cmd, "workflow", targetPath, deps);
        return;
      }
    }
  }

  // Source 3: built-in optional SpecKit commands (clarify/checklist/analyze).
  // Dispatch through the registered VS Code command so provider formatting
  // and step tracking match invoking it from the Command Palette.
  if (buttonCommand && isOptionalCommand(buttonCommand)) {
    deps.outputChannel.appendLine(
      `[SpecViewer] Executing optional command "${buttonCommand}" for: ${targetPath}`,
    );
    await vscode.commands.executeCommand(buttonCommand, targetPath);
    return;
  }

  deps.outputChannel.appendLine(
    `[SpecViewer] No custom command configured for step: ${docType}`,
  );
}

/**
 * Handle refine line request
 */
async function handleRefineLine(
  specDirectory: string,
  lineNum: number,
  content: string,
  instruction: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  deps.outputChannel.appendLine(
    `[SpecViewer] Refine line ${lineNum}: ${instruction}`,
  );
  // TODO: Implement AI-based refinement
  NotificationUtils.showStatusBarMessage(
    `$(sync~spin) Refining line ${lineNum}...`,
  );
}

/**
 * Handle edit line request
 */
async function handleEditLine(
  specDirectory: string,
  lineNum: number,
  newText: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const currentDoc = instance.state.availableDocuments.find(
    (d) => d.type === instance.state.currentDocument,
  );

  if (!currentDoc || !currentDoc.exists) return;

  try {
    const uri = vscode.Uri.file(currentDoc.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();

    if (lineNum > 0 && lineNum <= document.lineCount) {
      const line = document.lineAt(lineNum - 1);
      edit.replace(uri, line.range, newText);
      await vscode.workspace.applyEdit(edit);
      await document.save();
      deps.outputChannel.appendLine(`[SpecViewer] Edited line ${lineNum}`);
    }
  } catch (error) {
    deps.outputChannel.appendLine(`[SpecViewer] Error editing line: ${error}`);
  }
}

/**
 * Handle remove line request
 */
async function handleRemoveLine(
  specDirectory: string,
  lineNum: number,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const currentDoc = instance.state.availableDocuments.find(
    (d) => d.type === instance.state.currentDocument,
  );

  if (!currentDoc || !currentDoc.exists) return;

  try {
    const uri = vscode.Uri.file(currentDoc.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();

    if (lineNum > 0 && lineNum <= document.lineCount) {
      const line = document.lineAt(lineNum - 1);
      const range = line.rangeIncludingLineBreak;
      edit.delete(uri, range);
      await vscode.workspace.applyEdit(edit);
      await document.save();
      deps.outputChannel.appendLine(`[SpecViewer] Removed line ${lineNum}`);
    }
  } catch (error) {
    deps.outputChannel.appendLine(`[SpecViewer] Error removing line: ${error}`);
  }
}

/**
 * Handle checkbox toggle request - updates [ ] to [x] or vice versa
 */
async function handleToggleCheckbox(
  specDirectory: string,
  lineNum: number,
  checked: boolean,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const currentDoc = instance.state.availableDocuments.find(
    (d) => d.type === instance.state.currentDocument,
  );

  if (!currentDoc || !currentDoc.exists) return;

  try {
    const uri = vscode.Uri.file(currentDoc.filePath);
    const document = await vscode.workspace.openTextDocument(uri);

    if (lineNum > 0 && lineNum <= document.lineCount) {
      const line = document.lineAt(lineNum - 1);
      const lineText = line.text;

      // Replace [ ] with [x] or [x]/[X] with [ ]
      let newText: string;
      if (checked) {
        newText = lineText.replace(/\[ \]/, "[x]");
      } else {
        newText = lineText.replace(/\[[xX]\]/, "[ ]");
      }

      if (newText !== lineText) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, line.range, newText);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        deps.outputChannel.appendLine(
          `[SpecViewer] Toggled checkbox on line ${lineNum} to ${checked ? "checked" : "unchecked"}`,
        );
      }
    }
  } catch (error) {
    deps.outputChannel.appendLine(
      `[SpecViewer] Error toggling checkbox: ${error}`,
    );
  }
}

/**
 * Handle open file request from a file reference click
 */
async function handleOpenFile(
  filename: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const basename = path.basename(filename);
  const results = await vscode.workspace.findFiles(`**/${basename}`, null, 1);
  if (results.length === 0) {
    vscode.window.showWarningMessage(
      `File not found in workspace: ${basename}`,
    );
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(results[0]);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
    });
    deps.outputChannel.appendLine(
      `[SpecViewer] Opened file ref: ${results[0].fsPath}`,
    );
  } catch (error) {
    deps.outputChannel.appendLine(
      `[SpecViewer] Error opening file ref: ${error}`,
    );
  }
}

/**
 * Per-spec-dir write queue. `updateSpecContext` is read-modify-write with no
 * locking, so two comment mutations firing in quick succession (the webview
 * posts them fire-and-forget) could both read the same baseline and the second
 * write would clobber the first. Chaining per directory serializes them.
 */
// `commentWriteQueues` was lifted into the `CommentMutationQueue` class
// below; the bare-Map pattern is gone.

/**
 * Per-spec serial queue for review-comment mutations.
 *
 * Each spec directory's mutations chain through one Promise — concurrent
 * `addComment` / `removeComment` from the webview can't interleave reads
 * and writes against the same `.spec-context.json`. The previous shape was
 * a module-scope `Map<string, Promise<unknown>>` mutated in passing from
 * inside an async function with a manual `finally` cleanup. That worked
 * but was load-bearing module state pretending to be a variable.
 *
 * This class owns the same semantics but the lifecycle is explicit: each
 * call returns its run-promise, the map cleans itself once that promise
 * settles, and there is no exported handle for anything else to mutate.
 */
class CommentMutationQueue {
  private readonly queues = new Map<string, Promise<unknown>>();

  async enqueue(specDirectory: string, run: () => Promise<void>): Promise<void> {
    const prev = this.queues.get(specDirectory) ?? Promise.resolve();
    // .then(run, run) — chain even if a prior mutation rejected, so one
    // failed write doesn't permanently deadlock the spec's queue.
    const next = prev.then(run, run);
    this.queues.set(specDirectory, next);
    try {
      await next;
    } finally {
      if (this.queues.get(specDirectory) === next) {
        this.queues.delete(specDirectory);
      }
    }
  }
}

const commentQueue = new CommentMutationQueue();

/**
 * Persist a review-comment mutation through `specContextWriter` (the only
 * sanctioned writer) and push the refreshed viewerState to the webview so the
 * inline cards and the Activity comment list stay in sync. Comment writes never
 * touch `transitions`, so the writer's append-only guard passes untouched.
 */
async function persistCommentMutation(
  specDirectory: string,
  mutate: (ctx: SpecContext) => SpecContext,
  deps: MessageHandlerDependencies,
): Promise<void> {
  await commentQueue.enqueue(specDirectory, async () => {
    let current: SpecContext | null = null;
    try {
      current = await readSpecContext(specDirectory);
    } catch (err) {
      // Refuse to persist when the existing context is unreadable —
      // doing so would risk overwriting a real file with the fallback.
      deps.outputChannel.appendLine(
        `[SpecViewer] Skipping comment persist — readSpecContext failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    if (!current) {
      deps.outputChannel.appendLine(
        "[SpecViewer] No .spec-context.json — skipping comment persist",
      );
      return;
    }
    await updateSpecContext(specDirectory, mutate, current);
    await deps.refreshContextIfDisplaying(
      path.join(specDirectory, SPEC_CONTEXT_FILENAME),
    );
  });
}

/**
 * Persist a newly added inline comment. The anchor records the nearest heading
 * and surrounding block (read best-effort from the live source) so the comment
 * can be re-anchored on reopen even after the source drifts.
 */
async function handleAddComment(
  specDirectory: string,
  id: string,
  doc: ReviewCommentDoc,
  lineNum: number,
  lineContent: string,
  comment: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  let sourceLines: string[] | null = null;
  const sourceDoc = instance?.state.availableDocuments.find(
    (d) => d.type === doc || d.fileName === `${doc}.md` || d.fileName === doc,
  );
  if (sourceDoc) {
    try {
      const data = await vscode.workspace.fs.readFile(
        vscode.Uri.file(sourceDoc.filePath),
      );
      sourceLines = Buffer.from(data).toString("utf-8").split("\n");
    } catch {
      sourceLines = null;
    }
  }
  const rc = buildReviewComment(
    doc,
    lineNum,
    lineContent,
    sourceLines,
    comment,
    id,
  );
  await persistCommentMutation(
    specDirectory,
    (ctx) => addCommentToCtx(ctx, rc),
    deps,
  );
  deps.outputChannel.appendLine(
    `[SpecViewer] Persisted comment ${id} on ${doc}:${lineNum}`,
  );
}

/** Persist removal of a comment. */
async function handleRemoveComment(
  specDirectory: string,
  id: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  await persistCommentMutation(
    specDirectory,
    (ctx) => removeCommentFromCtx(ctx, id),
    deps,
  );
  deps.outputChannel.appendLine(`[SpecViewer] Removed comment ${id}`);
}

/**
 * Dispatch a document's pending comments to the AI as a direct-edit prompt,
 * then mark them `applied` (kept as history). Used by both the inline Refine
 * button and the Activity per-document Run refinement action.
 *
 * Never invoke a per-step slash command (e.g. /speckit.plan) — those re-run
 * setup scripts that overwrite the source from a template (issue #153).
 */
async function dispatchDocRefinement(
  specDirectory: string,
  doc: ReviewCommentDoc,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;
  let ctx: SpecContext | null = null;
  try {
    ctx = await readSpecContext(specDirectory);
  } catch (err) {
    deps.outputChannel.appendLine(
      `[SpecViewer] dispatchDocRefinement(comments): readSpecContext failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  if (!ctx) return;

  const pending = pendingForDoc(ctx, doc);
  if (pending.length === 0) {
    deps.outputChannel.appendLine(
      `[SpecViewer] No pending comments for ${doc} — nothing to refine`,
    );
    return;
  }

  // Resolve the AI-prompt target filename from the source doc so workflows
  // with non-matching step / file names (SDD's `specify` step → `spec.md`)
  // or non-core docs (e.g. `data-model`, `checklists/requirements`) target
  // the correct file. Fall back to `${doc}.md` when unresolved.
  const sourceDoc = instance.state.availableDocuments.find(
    (d) => d.type === doc || d.fileName === `${doc}.md` || d.fileName === doc,
  );
  const filename = sourceDoc?.fileName ?? `${doc}.md`;
  const targetPath = instance.state.changeRoot || specDirectory;

  const blockquote = (text: string) =>
    text
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
  const promptRefinementText = pending
    .map((c) => {
      const where = c.anchor.heading
        ? `Line ${c.anchor.line} in section "${c.anchor.heading}"`
        : `Line ${c.anchor.line}`;
      const indented = blockquote(c.anchor.blockText).replace(/^/gm, "  ");
      return `- ${where}: ${c.comment}\n${indented}`;
    })
    .join("\n\n");

  const prompt = [
    `Edit ${targetPath}/${filename} in place to apply ONLY these line-specific refinements.`,
    `DO NOT regenerate from any template.`,
    `DO NOT run any setup script (e.g. setup-spec.sh, setup-plan.sh, setup-tasks.sh).`,
    `DO NOT replace the file — make targeted edits only.`,
    ``,
    `Refinements requested:`,
    promptRefinementText,
  ].join("\n");

  deps.outputChannel.appendLine(
    `[SpecViewer] Dispatching ${pending.length} refinement(s) for ${doc} (direct edit)`,
  );
  await deps.executeInTerminal(prompt);

  // Mark the dispatched comments applied — kept in .spec-context.json as
  // history (no separate file). The viewer refreshes to show the new status.
  const ids = pending.map((c) => c.id);
  await persistCommentMutation(specDirectory, (c) => markApplied(c, ids), deps);
}

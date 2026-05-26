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
import {
  SPEC_CONTEXT_FILENAME,
  readSpecContext,
} from "../specs/specContextReader";
import { updateSpecContext } from "../specs/specContextWriter";
import {
  completeStep,
  reactivate,
  setStatus,
  startStep,
} from "../specs/stepLifecycle";
import { getFeatureWorkflow, getWorkflowCommands } from "../workflows";
import type { WorkflowStepConfig } from "../workflows/types";
import { isOptionalCommand } from "./optionalCommands";
import {
  addComment as addCommentToCtx,
  buildReviewComment,
  markApplied,
  pendingForDoc,
  removeComment as removeCommentFromCtx,
} from "./reviewComments";
import { findRunningStep } from "./stateDerivation";
import type { CoreDocumentType } from "./types";
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
 * Create message handlers for a spec directory
 */
export function createMessageHandlers(
  specDirectory: string,
  deps: MessageHandlerDependencies,
) {
  return async (message: ViewerToExtensionMessage) => {
    deps.outputChannel.appendLine(
      `[SpecViewer] Received message: ${message.type}`,
    );

    switch (message.type) {
      case "switchDocument":
        await handleSwitchDocument(specDirectory, message.documentType, deps);
        break;
      case "editDocument":
      case "editSource":
        await handleEditDocument(specDirectory, deps);
        break;
      case "refreshContent":
        await handleRefresh(specDirectory, deps);
        break;
      case "ready":
        deps.outputChannel.appendLine("[SpecViewer] Webview ready");
        // Push viewerState (incl. transitions) — initial HTML hydrates
        // navState and markdown, but viewerState only flows via message.
        await deps.refreshContextIfDisplaying(
          path.join(specDirectory, SPEC_CONTEXT_FILENAME),
        );
        break;
      case "stepperClick":
        await handleStepperClick(specDirectory, message.phase, deps);
        break;
      case "regenerate":
        await handleRegenerate(specDirectory, deps);
        break;
      case "approve":
        await handleApprove(specDirectory, deps);
        break;
      case "markStepComplete":
        await handleMarkStepComplete(specDirectory, deps);
        break;
      case "clarify":
        await handleClarify(specDirectory, deps, message.command);
        break;
      case "refineLine":
        await handleRefineLine(
          specDirectory,
          message.lineNum,
          message.content,
          message.instruction,
          deps,
        );
        break;
      case "editLine":
        await handleEditLine(
          specDirectory,
          message.lineNum,
          message.newText,
          deps,
        );
        break;
      case "removeLine":
        await handleRemoveLine(specDirectory, message.lineNum, deps);
        break;
      case "toggleCheckbox":
        await handleToggleCheckbox(
          specDirectory,
          message.lineNum,
          message.checked,
          deps,
        );
        break;
      case "addComment":
        await handleAddComment(
          specDirectory,
          message.id,
          message.doc,
          message.lineNum,
          message.lineContent,
          message.comment,
          deps,
        );
        break;
      case "removeComment":
        await handleRemoveComment(specDirectory, message.id, deps);
        break;
      case "runDocRefinement":
        await dispatchDocRefinement(specDirectory, message.doc, deps);
        break;
      case "completeSpec":
        await handleLifecycleAction(
          specDirectory,
          SpecStatuses.COMPLETED,
          deps,
        );
        break;
      case "archiveSpec":
        await handleLifecycleAction(specDirectory, SpecStatuses.ARCHIVED, deps);
        break;
      case "reactivateSpec":
        await handleLifecycleAction(specDirectory, SpecStatuses.ACTIVE, deps);
        break;
      case "openFile":
        await handleOpenFile(message.filename, deps);
        break;
      case "webviewError":
        deps.outputChannel.appendLine(
          `[SpecViewer] Webview error (${message.source}): ${message.message}` +
            (message.stack ? `\n${message.stack}` : ""),
        );
        break;
      case "footerAction":
        switch (message.id) {
          case FooterActionIds.ARCHIVE:
            await handleLifecycleAction(
              specDirectory,
              SpecStatuses.ARCHIVED,
              deps,
            );
            break;
          case FooterActionIds.REACTIVATE:
            await handleLifecycleAction(
              specDirectory,
              SpecStatuses.ACTIVE,
              deps,
            );
            break;
          case FooterActionIds.COMPLETE:
            await handleLifecycleAction(
              specDirectory,
              SpecStatuses.COMPLETED,
              deps,
            );
            break;
          case FooterActionIds.REGENERATE:
            await handleRegenerate(specDirectory, deps);
            break;
          case FooterActionIds.APPROVE:
          case FooterActionIds.START:
            await handleApprove(specDirectory, deps);
            break;
          case FooterActionIds.SDD_AUTO:
            await handleClarify(specDirectory, deps, "/sdd:auto");
            break;
          default:
            deps.outputChannel.appendLine(
              `[SpecViewer] Unknown footerAction id: ${message.id}`,
            );
        }
        break;
    }
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

  const docType = instance.state.currentDocument;
  const steps = await deps.resolveWorkflowSteps(specDirectory);
  const currentStep = steps.find((s) => s.name === docType);

  if (currentStep) {
    if (isLifecycleStep(docType)) {
      await startStep(specDirectory, docType as StepName, "extension");
    }
    await deps.updateContent(specDirectory, instance.state.currentDocument);
    await executeStepInTerminal(currentStep, specDirectory, deps);
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

  const docType = instance.state.currentDocument;
  const steps = await deps.resolveWorkflowSteps(specDirectory);
  // Filter out actionOnly steps for navigation purposes
  const navSteps = steps.filter((s) => !s.actionOnly);
  let currentIndex = navSteps.findIndex((s) => s.name === docType);
  if (currentIndex < 0) {
    // Viewing a related doc — resolve parent step
    const relatedDoc = instance.state.availableDocuments.find(
      (d) => d.type === docType && d.category === "related",
    );
    if (relatedDoc?.parentStep) {
      currentIndex = navSteps.findIndex(
        (s) => s.name === relatedDoc.parentStep,
      );
    }
  }

  // Mark the currently-viewed step as completed (independent of AI cooperation).
  if (isLifecycleStep(docType)) {
    await completeStep(specDirectory, docType as StepName, "extension");
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

  const ctx = await readSpecContext(specDirectory);
  const running = findRunningStep(ctx?.stepHistory)?.step ?? null;

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
async function handleClarify(
  specDirectory: string,
  deps: MessageHandlerDependencies,
  buttonCommand?: string,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;

  const docType = instance.state.currentDocument;

  const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
  const rawCommands = config.get<Array<CustomCommandConfig | string>>(
    "customCommands",
    [],
  );

  // Find the matching command - prefer exact match from button, fall back to first match for step
  for (const entry of rawCommands) {
    if (typeof entry === "string") continue;

    const command =
      entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
    if (!command) continue;

    // If button sent a specific command, match it; otherwise match by step
    if (buttonCommand) {
      if (command !== buttonCommand) continue;
    } else {
      const step = entry.step || "all";
      if (step !== docType && step !== "all") continue;
    }

    const targetPath = instance.state.changeRoot || specDirectory;
    const label = entry.title || entry.name || "Enhancement";
    const rawPrompt = `${command} "${targetPath}"`;
    const isMultiStep = command.includes(":auto");
    const prompt = isMultiStep
      ? buildLifecyclePrompt(rawPrompt, targetPath)
      : rawPrompt;
    deps.outputChannel.appendLine(
      `[SpecViewer] Executing enhancement command "${label}": ${rawPrompt}`,
    );
    await deps.executeInTerminal(prompt);
    return;
  }

  // Fall back to workflow commands
  const featureCtx = await getFeatureWorkflow(
    specDirectory,
    instance.state.changeRoot,
  );
  if (featureCtx?.workflow) {
    for (const wfCmd of getWorkflowCommands(featureCtx.workflow)) {
      if (!wfCmd.command) continue;

      if (buttonCommand) {
        if (wfCmd.command !== buttonCommand) continue;
      } else {
        const step = wfCmd.step || "all";
        if (step !== docType && step !== "all") continue;
      }

      const targetPath = instance.state.changeRoot || specDirectory;
      const label = wfCmd.title || wfCmd.name || "Enhancement";
      const rawPrompt = `${wfCmd.command} "${targetPath}"`;
      const isMultiStep = wfCmd.command.includes(":auto");
      const prompt = isMultiStep
        ? buildLifecyclePrompt(rawPrompt, targetPath)
        : rawPrompt;
      deps.outputChannel.appendLine(
        `[SpecViewer] Executing workflow command "${label}": ${rawPrompt}`,
      );
      await deps.executeInTerminal(prompt);
      return;
    }
  }

  // Built-in optional SpecKit commands (clarify/checklist/analyze): dispatch
  // through the registered VS Code command so provider formatting and step
  // tracking match invoking it from the Command Palette.
  if (buttonCommand && isOptionalCommand(buttonCommand)) {
    const targetPath = instance.state.changeRoot || specDirectory;
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
const commentWriteQueues = new Map<string, Promise<unknown>>();

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
  const run = async () => {
    const current = await readSpecContext(specDirectory);
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
  };
  const prev = commentWriteQueues.get(specDirectory) ?? Promise.resolve();
  const next = prev.then(run, run);
  commentWriteQueues.set(specDirectory, next);
  try {
    await next;
  } finally {
    if (commentWriteQueues.get(specDirectory) === next) {
      commentWriteQueues.delete(specDirectory);
    }
  }
}

/**
 * Persist a newly added inline comment. The anchor records the nearest heading
 * and surrounding block (read best-effort from the live source) so the comment
 * can be re-anchored on reopen even after the source drifts.
 */
async function handleAddComment(
  specDirectory: string,
  id: string,
  doc: CoreDocumentType,
  lineNum: number,
  lineContent: string,
  comment: string,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  let sourceLines: string[] | null = null;
  const sourceDoc = instance?.state.availableDocuments.find(
    (d) => d.isCore && (d.type === doc || d.fileName === `${doc}.md`),
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
  doc: CoreDocumentType,
  deps: MessageHandlerDependencies,
): Promise<void> {
  const instance = deps.getInstance(specDirectory);
  if (!instance) return;
  const ctx = await readSpecContext(specDirectory);
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
  // target the correct file. Fall back to `${doc}.md` when unresolved.
  const sourceDoc = instance.state.availableDocuments.find(
    (d) => d.isCore && (d.type === doc || d.fileName === `${doc}.md`),
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

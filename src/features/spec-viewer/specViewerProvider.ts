/**
 * SpecKit Companion - Spec Viewer Provider
 * Provides the spec viewer webview panel for viewing spec documents.
 * Supports multiple panels - one per spec directory.
 */

import * as path from "path";
import * as vscode from "vscode";
import { scanDocuments } from "./documentScanner";
import { generateHtml } from "./html";
import { createMessageHandlers } from "./messageHandlers";
import { computeStaleness } from "./staleness";
import {
  computePanelDerivedState,
  mapStepHistoryToTabKeys,
  resolveDisplayDocument,
  resolveTabClickDocument,
} from "./panelStateComputer";
import { PanelInstance, PanelRegistry } from "./panelRegistry";
import { getAIProvider } from "../../extension";
import {
  calculatePhases,
  calculateTaskCompletion,
  calculateWorkflowPhase,
  getPhaseNumber,
  mapSddStepToTab,
  computeBadgeText,
  computeCreatedDate,
  computeLastUpdatedDate,
  getDocTypeLabel,
} from "./phaseCalculation";
import {
  CORE_DOCUMENTS,
  CoreDocumentType,
  DEFAULT_EMPTY_MESSAGE,
  DocumentType,
  EMPTY_STATE_MESSAGES,
  EnhancementButton,
  ExtensionToViewerMessage,
  NavState,
  SpecDocument,
  SpecStatus,
  SpecViewerState,
} from "./types";
import { getDocumentTypeFromPath, getSpecDirectoryFromPath } from "./utils";
import { optionalCommandButtonsForTab } from "./optionalCommands";
import { ConfigKeys, SpecStatuses, WorkflowSteps } from "../../core/constants";
import type { CustomCommandConfig } from "../../core/types/config";
import { deriveChangeRoot } from "../../core/specDirectoryResolver";
import { deriveSpecName } from "../specs/specContextManager";
import { readSpecContext, SPEC_CONTEXT_FILENAME } from "../specs/specContextReader";
import { writeSpecContext } from "../specs/specContextWriter";
import { deriveStepHistory } from "../specs/stepHistoryDerivation";
import { backfillMinimalContext } from "../specs/specContextBackfill";
import { reconcileAndPersist } from "../specs/specContextReconciler";
import { deriveViewerState, isStepCompleted, findRunningStep } from "./stateDerivation";
import { hasNonTrivialArtifact } from "./stepArtifact";
import { StepCompletionNotifier, NotifierContext } from "./stepCompletionNotifier";
import { StepName, STEP_NAMES, Status, ViewerState as CoreViewerState } from "../../core/types/specContext";
import {
  DEFAULT_WORKFLOW,
  getFeatureWorkflow,
  resolveWorkflow,
  getWorkflow,
  getWorkflowCommands,
  normalizeWorkflowConfig,
} from "../workflows";
import type { FeatureWorkflowContext, WorkflowStepConfig } from "../workflows/types";

// Re-export utility functions for external use
export {
  getDocumentTypeFromPath,
  getSpecDirectoryFromPath,
  isSpecDocument,
} from "./utils";

// `mapStepHistoryKeys` and `deriveStepBadgesWithAlias` previously lived
// here; they were structurally identical to the helpers in
// `./panelStateComputer.ts` and were extracted there so all
// three render paths (full render, tab click, viewer-state refresh) share
// one implementation.

/**
 * Create a minimal `.spec-context.json` when none exists (FR-011).
 * Marks only what can be verified: workflow, branch, specName, status=draft.
 * Never reads step files to infer completion.
 *
 * On a READ failure (file exists but is mid-write / corrupt / unreadable),
 * returns an in-memory backfill WITHOUT touching disk — clobbering a real
 * file because we couldn't parse it would destroy lifecycle history.
 */
async function ensureSpecContext(
  specDirectory: string,
  workflowName?: string,
  outputChannel?: vscode.OutputChannel,
): Promise<ReturnType<typeof readSpecContext> extends Promise<infer T> ? T : never> {
  let existing: Awaited<ReturnType<typeof readSpecContext>>;
  try {
    existing = await readSpecContext(specDirectory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(
      `[SpecViewer] readSpecContext failed for ${specDirectory}: ${msg} — rendering with in-memory backfill, NOT writing.`,
    );
    const specName = path.basename(specDirectory);
    return backfillMinimalContext({
      workflow: workflowName || 'speckit-companion',
      specName,
      branch: specName,
    });
  }
  if (existing) return existing;
  const specName = path.basename(specDirectory);
  const ctx = backfillMinimalContext({
    workflow: workflowName || 'speckit-companion',
    specName,
    branch: specName,
  });
  try {
    await writeSpecContext(specDirectory, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(
      `[SpecViewer] writeSpecContext failed for ${specDirectory}: ${msg}`,
    );
  }
  return ctx;
}

// `PanelInstance` interface and the Map ownership moved to
// `./panelRegistry.ts`. The provider now uses
// `this.panels.get(...)` etc. as methods on the registry rather than
// raw Map operations, and lifecycle behaviour (debounce-timer cleanup
// on delete) lives in the registry.

/**
 * Provides the spec viewer webview panel for viewing spec documents.
 * Supports multiple panels - one per spec directory.
 */
export class SpecViewerProvider {
  /** Per-spec-directory panel instances; debounce-timer cleanup lives in the registry's `delete`. */
  private readonly panels = new PanelRegistry();

  /** Fires VS Code + OS notifications when a dispatched step completes. */
  private readonly stepCompletionNotifier = new StepCompletionNotifier();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  /**
   * Read `speckit.viewer.activityPanel` from VS Code settings. Falls back
   * to `"beta"` if the setting is missing or has an unknown value.
   */
  private readActivityPanelMode(): 'off' | 'beta' | 'on' {
    const v = vscode.workspace
      .getConfiguration('speckit.viewer')
      .get<string>('activityPanel', 'beta');
    return v === 'off' || v === 'on' ? v : 'beta';
  }

  /**
   * Resolve workflow steps for a spec directory.
   * Checks persisted context first, then auto-selects and persists the default.
   */
  private async resolveWorkflowSteps(
    specDirectory: string,
    changeRoot?: string | null,
  ): Promise<WorkflowStepConfig[]> {
    try {
      // 1. Check for feature-level .spec-context.json (checks both specDir and changeRoot)
      const ctx = await getFeatureWorkflow(specDirectory, changeRoot);
      if (ctx) {
        // Resolve workflow config; fall back to default for unrecognized names
        const wf = getWorkflow(ctx.workflow) || DEFAULT_WORKFLOW;
        const normalized = normalizeWorkflowConfig(wf);
        if (normalized.steps && normalized.steps.length > 0) {
          return normalized.steps;
        }
      }
    } catch {
      // fall through
    }

    // 2. No persisted context — resolve default without writing to disk
    const selected = await resolveWorkflow(specDirectory);
    if (selected) {
      const normalized = normalizeWorkflowConfig(selected);
      if (normalized.steps && normalized.steps.length > 0) {
        return normalized.steps;
      }
    }

    return DEFAULT_WORKFLOW.steps!;
  }

  /**
   * Compute the change root for a spec directory
   */
  private computeChangeRoot(specDirectory: string): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;
    return deriveChangeRoot(specDirectory, workspaceFolder.uri.fsPath);
  }

  /**
   * Show the spec viewer with the specified document
   */
  public async show(filePath: string): Promise<void> {
    let specDirectory = getSpecDirectoryFromPath(filePath);
    let documentType = getDocumentTypeFromPath(filePath);

    this.outputChannel.appendLine(
      `[SpecViewer] Opening ${documentType} from ${specDirectory}`,
    );

    // Check if panel already exists for this spec
    let existingInstance = this.panels.get(specDirectory);

    // If no exact match, check if this file is a sub-doc of an existing panel
    if (!existingInstance) {
      for (const [panelDir, inst] of this.panels) {
        if (filePath.startsWith(panelDir + path.sep)) {
          // Find the matching related doc by filePath
          const matchingDoc = inst.state.availableDocuments.find(
            d => d.filePath === filePath,
          );
          if (matchingDoc) {
            specDirectory = panelDir;
            documentType = matchingDoc.type;
            existingInstance = inst;
            break;
          }
        }
      }
    }

    if (existingInstance) {
      // Update existing panel and reveal
      await this.updateContent(specDirectory, documentType);
      existingInstance.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create new panel for this spec
    await this.createPanel(specDirectory, documentType);
  }

  /**
   * Get panel instance for a spec directory
   */
  private getInstance(specDirectory: string): PanelInstance | undefined {
    return this.panels.get(specDirectory);
  }

  /**
   * Refresh content if currently displaying the specified file
   */
  public async refreshIfDisplaying(filePath: string): Promise<void> {
    const specDirectory = getSpecDirectoryFromPath(filePath);
    const instance = this.panels.get(specDirectory);

    if (!instance) {
      return;
    }

    this.outputChannel.appendLine(
      `[SpecViewer] Refreshing due to file change: ${filePath}`,
    );

    // Auto-navigate to newly created file
    const docType = getDocumentTypeFromPath(filePath);
    const wasNew = !instance.state.availableDocuments.find(
      d => d.type === docType && d.exists,
    );

    await this.updateContent(
      instance.state.specDirectory,
      wasNew ? docType : instance.state.currentDocument,
    );
  }

  /**
   * Re-read `.spec-context.json` and re-post `viewerState` (including
   * `transitions`) to the open viewer for the spec containing this context
   * file. Markdown is not touched. No-op when no panel is open.
   */
  public async refreshContextIfDisplaying(specContextPath: string): Promise<void> {
    const specDir = path.dirname(specContextPath);
    const instance = this.panels.get(specDir);
    if (!instance) return;

    try {
      let specCtx = await readSpecContext(specDir);
      if (!specCtx) return;
      specCtx = await reconcileAndPersist(specDir, specCtx, (m) => this.outputChannel.appendLine(m));

      const active: StepName = STEP_NAMES.includes(specCtx.currentStep as StepName)
        ? (specCtx.currentStep as StepName)
        : 'specify';
      const wfSteps = (getWorkflow(specCtx.workflow) || DEFAULT_WORKFLOW).steps;
      const derived = deriveViewerState(specCtx, active, wfSteps);
      const viewerState: CoreViewerState = {
        ...derived,
        footer: derived.footer.map(a => ({
          id: a.id,
          label: a.label,
          scope: a.scope,
          tooltip: a.tooltip,
        })) as CoreViewerState['footer'],
      };

      // Send a contentUpdated message with empty content — the webview only
      // applies the viewerState fields when content is empty/unchanged. To
      // avoid clobbering the markdown, only post viewerState via the
      // viewerStateUpdated channel (the webview's index.tsx handles it).
      const derivedStepHistory = deriveStepHistory(
        (specCtx.history ?? []) as any,
        active,
        specCtx.status as Status | undefined,
      );
      const navStatePartial = {
        stepHistory: mapStepHistoryToTabKeys(derivedStepHistory),
        currentStep: specCtx.currentStep,
        badgeText: computeBadgeText(specCtx, derivedStepHistory),
      };
      instance.panel.webview.postMessage({
        type: 'viewerStateUpdated',
        viewerState,
        navState: navStatePartial,
      });
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] refreshContextIfDisplaying failed: ${error}`,
      );
    }
  }

  /**
   * Handle file deletion
   */
  public handleFileDeleted(filePath: string): void {
    const specDirectory = getSpecDirectoryFromPath(filePath);
    const instance = this.panels.get(specDirectory);

    if (!instance) {
      return;
    }

    const documentType = getDocumentTypeFromPath(filePath);

    this.outputChannel.appendLine(`[SpecViewer] File deleted: ${filePath}`);

    // If `.spec-context.json` was the deleted file, invalidate the cached
    // `lastFeatureCtx` so the step-completion notifier doesn't fire on a
    // stale "previous" context when the file is recreated. Without this,
    // a delete-then-recreate sequence could surface a bogus delta.
    if (filePath.endsWith(SPEC_CONTEXT_FILENAME)) {
      instance.lastFeatureCtx = null;
    }

    // If the current document was deleted, show error message
    if (documentType === instance.state.currentDocument) {
      this.postMessage(specDirectory, {
        type: "fileDeleted",
        filePath,
      });
    }

    // Refresh documents list
    this.updateContent(
      instance.state.specDirectory,
      instance.state.currentDocument,
    );
  }

  /**
   * Create the webview panel
   */
  private async createPanel(
    specDirectory: string,
    documentType: DocumentType,
  ): Promise<void> {
    const specName = path.basename(specDirectory);

    const panel = vscode.window.createWebviewPanel(
      "speckit.specViewer",
      `Spec: ${specName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "webview"),
          vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview"),
        ],
      },
    );

    // Initialize state with defaults
    const initialState: SpecViewerState = {
      specName,
      specDirectory,
      currentDocument: documentType,
      availableDocuments: [],
      lastUpdated: Date.now(),
      phases: [],
      currentPhase: 1,
      taskCompletionPercent: 0,
    };

    // Create panel instance
    const instance: PanelInstance = {
      panel,
      state: initialState,
      debounceTimer: undefined,
      firstOpenComplete: false,
    };

    // Store in map
    this.panels.set(specDirectory, instance);

    // Handle disposal
    panel.onDidDispose(() => {
      this.outputChannel.appendLine(
        `[SpecViewer] Panel disposed for ${specDirectory}`,
      );
      this.stepCompletionNotifier.forget(specDirectory);
      // PanelRegistry.delete clears any pending debounceTimer for us.
      this.panels.delete(specDirectory);
    });

    // Setup message handling
    this.setupMessageHandling(specDirectory);

    // Load initial content
    await this.updateContent(specDirectory, documentType);
  }

  /**
   * Setup message handling from webview
   */
  private setupMessageHandling(specDirectory: string): void {
    const instance = this.panels.get(specDirectory);
    if (!instance) return;

    const messageHandler = createMessageHandlers(specDirectory, {
      getInstance: dir => this.getInstance(dir),
      updateContent: (dir, docType) => this.updateContent(dir, docType),
      sendContentUpdateMessage: (dir, docType) =>
        this.sendContentUpdateMessage(dir, docType),
      refreshContextIfDisplaying: ctxPath => this.refreshContextIfDisplaying(ctxPath),
      resolveWorkflowSteps: dir => {
        const inst = this.getInstance(dir);
        return this.resolveWorkflowSteps(dir, inst?.state.changeRoot);
      },
      executeInTerminal: async (prompt: string) => {
        await getAIProvider().executeInTerminal(prompt);
      },
      outputChannel: this.outputChannel,
      context: this.context,
    });

    instance.panel.webview.onDidReceiveMessage(
      messageHandler,
      undefined,
      this.context.subscriptions,
    );
  }

  /**
   * Update content in the panel
   */
  private async updateContent(
    specDirectory: string,
    documentType: DocumentType,
  ): Promise<void> {
    const instance = this.panels.get(specDirectory);
    if (!instance) return;

    try {
      // Compute change root for two-level layouts
      const changeRoot = this.computeChangeRoot(specDirectory);

      // Scan for available documents using workflow steps
      const steps = await this.resolveWorkflowSteps(specDirectory, changeRoot);
      const documents = await scanDocuments(specDirectory, this.outputChannel, steps, changeRoot);
      const specName = path.basename(specDirectory);

      // Single context read: determine spec status + drive stepHistory badges.
      // Tolerate getFeatureWorkflow throws (post-Fix-2 it raises on
      // parse/IO errors instead of silently returning undefined) — a
      // transient read failure must not crash a tab click.
      let featureCtx: FeatureWorkflowContext | undefined;
      try {
        featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
      } catch (err) {
        this.outputChannel.appendLine(
          `[SpecViewer] getFeatureWorkflow failed for ${specDirectory}: ${err instanceof Error ? err.message : String(err)} — rendering without context.`,
        );
        featureCtx = undefined;
      }
      // First-open only: create the context file if missing. Subsequent
      // tab clicks are strictly read-only — never re-trigger ensureSpecContext
      // because a transient read failure mid-write could otherwise wipe
      // real lifecycle history.
      if (!featureCtx && !instance.firstOpenComplete) {
        const workflowName =
          (await resolveWorkflow(specDirectory))?.name ?? DEFAULT_WORKFLOW.name;
        await ensureSpecContext(specDirectory, workflowName, this.outputChannel);
        try {
          featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
        } catch {
          featureCtx = undefined;
        }
      }
      instance.firstOpenComplete = true;

      // Resolve which document to display (cascading fallback)
      const doc = resolveDisplayDocument(documents, documentType);

      // Read content + tasks.md (I/O)
      const { content, emptyMessage } = await this.readDocumentContent(doc);
      const tasksContent = await this.readTasksContent(doc, documents, content);

      // Resolve enhancement buttons (vscode config + workflow defaults)
      const enhancementButtons = this.resolveEnhancementButtons(
        doc?.type || CORE_DOCUMENTS.SPEC,
        featureCtx?.workflow,
      );

      // Pure derivation: stepHistory, phases, status, badges, dates, footer
      const derived = computePanelDerivedState(
        { documents, doc, tasksContent, featureCtx },
        enhancementButtons,
      );

      // Update state (I/O + cache)
      instance.state = {
        specName,
        specDirectory,
        changeRoot,
        currentDocument: doc?.type || CORE_DOCUMENTS.SPEC,
        availableDocuments: documents,
        lastUpdated: Date.now(),
        phases: derived.phases,
        currentPhase: derived.currentPhase,
        taskCompletionPercent: derived.taskCompletionPercent,
      };

      const docLabel = doc?.label || "Spec";
      instance.panel.title = `Spec: ${specName} - ${docLabel}`;

      // Staleness and running-step are still I/O (filesystem probes); compute
      // here after derived state is known so taskCompletionPercent feeds them.
      const stalenessMap = await computeStaleness(documents);
      const runInfo = await this.deriveRunningStepInfo(
        derived.derivedStepHistory,
        specDirectory,
        derived.taskCompletionPercent,
      );

      // Generate and set HTML
      instance.panel.webview.html = generateHtml(
        instance.panel.webview,
        this.context.extensionUri,
        content,
        emptyMessage,
        documents,
        doc?.type || CORE_DOCUMENTS.SPEC,
        specName,
        derived.phases,
        derived.taskCompletionPercent,
        derived.specStatus,
        enhancementButtons,
        stalenessMap,
        runInfo.tab,
        derived.badgeText,
        derived.createdDate,
        derived.lastUpdatedDate,
        featureCtx?.specName ?? deriveSpecName(specDirectory),
        featureCtx?.workingBranch ?? featureCtx?.branch ?? null,
        doc?.filePath ?? null,
        featureCtx?.currentStep ?? doc?.type ?? null,
        derived.stepHistoryByTab,
        this.readActivityPanelMode(),
        runInfo.artifactReady,
        runInfo.startedAt,
        runInfo.label,
      );

      this.outputChannel.appendLine(
        `[SpecViewer] Updated content: ${specName}/${doc?.type || "unknown"}`,
      );
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] Error updating content: ${error}`,
      );
      this.postMessage(specDirectory, {
        type: "error",
        message: `Failed to load document: ${error}`,
        recoverable: true,
      });
    }
  }

  /**
   * Resolve enhancement buttons for a document type from customCommands setting
   * and workflow commands.
   */
  private resolveEnhancementButtons(
    docType: DocumentType,
    workflowName?: string,
  ): EnhancementButton[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const rawCommands = config.get<Array<CustomCommandConfig | string>>("customCommands", []);

    const buttons: EnhancementButton[] = [];
    const seenCommands = new Set<string>();

    for (const entry of rawCommands) {
      if (typeof entry === "string") continue;
      const step = entry.step || "all";
      if (step !== docType && step !== "all") continue;

      const title = entry.title || entry.name;
      if (!title) continue;

      const command = entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
      if (!command) continue;

      seenCommands.add(command);
      buttons.push({
        label: title,
        command,
        icon: "⚡",
        tooltip: entry.tooltip || title,
      });
    }

    // Merge workflow commands
    if (workflowName) {
      for (const wfCmd of getWorkflowCommands(workflowName)) {
        if (!wfCmd.command) continue;
        const rawStep = wfCmd.step || "all";
        const step = rawStep === "all" ? "all" : (mapSddStepToTab(rawStep) || rawStep);
        if (step !== docType && step !== "all") continue;
        if (seenCommands.has(wfCmd.command)) continue;

        const title = wfCmd.title || wfCmd.name;
        if (!title) continue;

        seenCommands.add(wfCmd.command);
        buttons.push({
          label: title,
          command: wfCmd.command,
          icon: "⚡",
          tooltip: wfCmd.tooltip || title,
        });
      }
    }

    // Append built-in optional SpecKit command buttons for this tab, deduped
    // against user/workflow commands (which take precedence).
    buttons.push(...optionalCommandButtonsForTab(docType, seenCommands));

    return buttons;
  }

  /**
   * Spec 099: content-aware running-step info for the footer's Generating→ready
   * transition. Shipped to the webview via *both* the initial HTML navState
   * (watcher refresh path) and the contentUpdated message (tab-switch path) so
   * the state is consistent however the viewer last refreshed. Touches disk
   * only while a step is actually running — idle specs do no extra I/O.
   */
  private async deriveRunningStepInfo(
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }> | undefined,
    specDirectory: string,
    taskCompletionPercent: number,
  ): Promise<{
    tab: string | null;
    artifactReady: boolean | undefined;
    startedAt: string | null;
    label: string | null;
  }> {
    const running = findRunningStep(stepHistory);
    if (!running) {
      return { tab: null, artifactReady: undefined, startedAt: null, label: null };
    }
    // The implement step produces no single markdown artifact — treat it ready
    // once every task is checked.
    const artifactReady =
      running.step === WorkflowSteps.IMPLEMENT
        ? taskCompletionPercent === 100
        : await hasNonTrivialArtifact(specDirectory, running.step);
    return {
      tab: mapSddStepToTab(running.step) || running.step,
      artifactReady,
      startedAt: running.startedAt,
      label: getDocTypeLabel(running.step),
    };
  }

  /**
   * Read the content of the active document. Returns the file content (or
   * an empty string) plus an `emptyMessage` that's only populated when the
   * doc is missing or unreadable. Centralising this here means
   * `updateContent` and `sendContentUpdateMessage` no longer carry copies
   * of the same try/catch + empty-state ladder.
   */
  private async readDocumentContent(
    doc: SpecDocument | undefined,
  ): Promise<{ content: string; emptyMessage: string }> {
    if (doc?.exists) {
      try {
        const uri = vscode.Uri.file(doc.filePath);
        const data = await vscode.workspace.fs.readFile(uri);
        return { content: Buffer.from(data).toString("utf-8"), emptyMessage: "" };
      } catch (error) {
        this.outputChannel.appendLine(
          `[SpecViewer] Error reading ${doc.filePath}: ${error}`,
        );
        return { content: "", emptyMessage: `Error reading file: ${error}` };
      }
    }
    const emptyMessage =
      doc?.type && doc.type in EMPTY_STATE_MESSAGES
        ? EMPTY_STATE_MESSAGES[doc.type as CoreDocumentType]
        : DEFAULT_EMPTY_MESSAGE;
    return { content: "", emptyMessage };
  }

  /**
   * Read `tasks.md` content for completion-percentage computation. When the
   * active doc IS tasks.md, reuse the already-loaded content rather than
   * hitting disk a second time.
   */
  private async readTasksContent(
    activeDoc: SpecDocument | undefined,
    documents: SpecDocument[],
    activeContent: string,
  ): Promise<string> {
    if (activeDoc?.type === CORE_DOCUMENTS.TASKS) return activeContent;
    const tasksDoc = documents.find(d => d.type === CORE_DOCUMENTS.TASKS);
    if (!tasksDoc || !tasksDoc.exists) return "";
    try {
      const uri = vscode.Uri.file(tasksDoc.filePath);
      const data = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(data).toString("utf-8");
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] Error reading tasks.md for completion: ${error}`,
      );
      return "";
    }
  }

  /**
   * Post message to webview
   */
  private postMessage(
    specDirectory: string,
    message: ExtensionToViewerMessage,
  ): void {
    const instance = this.panels.get(specDirectory);
    instance?.panel.webview.postMessage(message);
  }

  /**
   * Send content update via message (no full HTML regeneration)
   * Used for smoother tab switching without page flash
   */
  private async sendContentUpdateMessage(
    specDirectory: string,
    documentType: DocumentType,
  ): Promise<void> {
    const instance = this.panels.get(specDirectory);
    if (!instance) return;

    try {
      // Tab-click resolution: honour the user's pick; only redirect when
      // the chosen core doc doesn't exist but a sub-spec under it does.
      const resolved = resolveTabClickDocument(instance.state.availableDocuments, documentType);
      if (!resolved) {
        this.outputChannel.appendLine(
          `[SpecViewer] Document not found: ${documentType}`,
        );
        return;
      }
      const doc = resolved;
      if (resolved.type !== documentType) documentType = resolved.type;

      const { content } = await this.readDocumentContent(doc);
      const tasksContent = await this.readTasksContent(doc, instance.state.availableDocuments, content);

      // Tolerate transient read failures so a render pass during a concurrent
      // CLI write degrades to "active" rather than crashing the whole update.
      const changeRoot = instance.state.changeRoot;
      let featureCtx: FeatureWorkflowContext | undefined;
      try {
        featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
      } catch (err) {
        this.outputChannel.appendLine(
          `[SpecViewer] sendContentUpdateMessage: getFeatureWorkflow failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const enhancementButtons = this.resolveEnhancementButtons(documentType, featureCtx?.workflow);

      const derived = computePanelDerivedState(
        { documents: instance.state.availableDocuments, doc, tasksContent, featureCtx },
        enhancementButtons,
      );

      // Compute staleness and run-step (I/O), and fire step-complete
      // notifications based on transitions in derivedStepHistory.
      const stalenessMap = await computeStaleness(instance.state.availableDocuments);

      const notifierCtx: NotifierContext | null = derived.derivedStepHistory
        ? { stepHistory: derived.derivedStepHistory }
        : null;
      const prevDerived = instance.lastFeatureCtx
        ? deriveStepHistory(
            (instance.lastFeatureCtx.history ?? []) as any,
            instance.lastFeatureCtx.currentStep as StepName | undefined,
            instance.lastFeatureCtx.status as Status | undefined,
          )
        : undefined;
      const prevNotifierCtx: NotifierContext | null = prevDerived
        ? { stepHistory: prevDerived }
        : null;
      this.stepCompletionNotifier.observe(specDirectory, prevNotifierCtx, notifierCtx);
      instance.lastFeatureCtx = featureCtx ?? null;

      const runInfo = await this.deriveRunningStepInfo(
        derived.derivedStepHistory,
        specDirectory,
        derived.taskCompletionPercent,
      );

      const navState: NavState = {
        coreDocs: derived.coreDocs,
        relatedDocs: derived.relatedDocs,
        currentDoc: documentType,
        workflowPhase: derived.workflowPhase,
        taskCompletionPercent: derived.taskCompletionPercent,
        isViewingRelatedDoc: derived.isViewingRelatedDoc,
        footerState: {
          showApproveButton: derived.footer.showApproveButton,
          approveText: derived.footer.approveText,
          enhancementButtons,
          specStatus: derived.specStatus,
        },
        enhancementButtons,
        stalenessMap,
        specStatus: derived.specStatus,
        currentTask: featureCtx?.currentTask ?? null,
        activeStep: runInfo.tab,
        runningStepArtifactReady: runInfo.artifactReady,
        runningStepStartedAt: runInfo.startedAt,
        runningStepLabel: runInfo.label,
        stepHistory: derived.stepHistoryByTab,
        badgeText: derived.badgeText,
        createdDate: derived.createdDate,
        lastUpdatedDate: derived.lastUpdatedDate,
        specContextName: featureCtx?.specName ?? deriveSpecName(specDirectory),
        branch: featureCtx?.workingBranch ?? featureCtx?.branch ?? null,
        currentStep: featureCtx?.currentStep ?? documentType ?? null,
        filePath: doc?.filePath ?? null,
        docTypeLabel: getDocTypeLabel(featureCtx?.currentStep ?? documentType),
        activityPanelMode: this.readActivityPanelMode(),
      };

      instance.state.currentDocument = documentType;
      instance.state.taskCompletionPercent = derived.taskCompletionPercent;
      instance.state.currentPhase = getPhaseNumber(documentType);

      const docLabel = doc.label || "Spec";
      instance.panel.title = `Spec: ${instance.state.specName} - ${docLabel}`;

      // Derive ViewerState from the canonical .spec-context.json (if present),
      // serializing footer to strip function fields.
      let viewerState: CoreViewerState | undefined;
      try {
        let specCtx = await readSpecContext(specDirectory);
        if (specCtx) {
          specCtx = await reconcileAndPersist(specDirectory, specCtx, (m) => this.outputChannel.appendLine(m));
          const active: StepName = (STEP_NAMES.includes(specCtx.currentStep as StepName)
            ? (specCtx.currentStep as StepName)
            : 'specify');
          const wfSteps = (getWorkflow(specCtx.workflow) || DEFAULT_WORKFLOW).steps;
          const derived = deriveViewerState(specCtx, active, wfSteps);
          viewerState = {
            ...derived,
            footer: derived.footer.map(a => ({
              id: a.id,
              label: a.label,
              scope: a.scope,
              tooltip: a.tooltip,
              // visibleWhen stripped at serialization boundary
            })) as CoreViewerState['footer'],
          };
        }
      } catch (error) {
        this.outputChannel.appendLine(
          `[SpecViewer] deriveViewerState failed: ${error}`,
        );
      }

      // Send content via message (no full HTML regeneration)
      const encodedContent = Buffer.from(content).toString("base64");
      this.postMessage(specDirectory, {
        type: "contentUpdated",
        content: encodedContent,
        documentType,
        specName: instance.state.specName,
        navState,
        viewerState,
      });

      this.outputChannel.appendLine(
        `[SpecViewer] Sent content update: ${instance.state.specName}/${documentType}`,
      );
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] Error sending content update: ${error}`,
      );
    }
  }
}

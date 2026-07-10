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
  resolveDisplayDocument,
  resolveTabClickDocument,
  resolveSpecStatus,
  type PanelDerivedState,
} from "./panelStateComputer";
import { PanelInstance, PanelRegistry } from "./panelRegistry";
import { getAIProvider } from "../../extension";
import {
  calculatePhases,
  calculateTaskCompletion,
  calculateWorkflowPhase,
  getPhaseNumber,
  mapStepToTab,
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
import { ConfigKeys, SpecStatuses } from "../../core/constants";
import { coerceLegacyBoolean } from "../../core/settingsMigration";
import type { CustomCommandConfig } from "../../core/types/config";
import { deriveChangeRoot } from "../../core/specDirectoryResolver";
import { deriveSpecName } from "../specs/specContextManager";
import { readSpecContext, SPEC_CONTEXT_FILENAME, SpecContextParseError } from "../specs/specContextReader";
import { writeSpecContext } from "../specs/specContextWriter";
import { synthesizeCustomProgress, stepHasOutput } from "../specs/customWorkflowProgress";
import { deriveStepHistory } from "../specs/stepHistoryDerivation";
import { backfillMinimalContext } from "../specs/specContextBackfill";
import { resetMalformedContext } from "../specs/specContextReset";
import { reconcileAndPersist } from "../specs/specContextReconciler";
import { isCompanionInstalled } from "../settings/companionPresetReconciler";
import { shouldShowInstallPrompt, readInstallPromptEnabled } from "../../speckit/specKitExtensionInstall";
import { deriveViewerState, isStepCompleted, findRunningStep } from "./stateDerivation";
import { enrichLivingSpecs } from "./livingSpecsContent";
import { StepCompletionNotifier, NotifierContext } from "./stepCompletionNotifier";
import { StepName, STEP_NAMES, Status, ViewerState as CoreViewerState } from "../../core/types/specContext";
import {
  DEFAULT_WORKFLOW,
  getFeatureWorkflow,
  getWorkflow,
  normalizeWorkflowConfig,
  resolveWorkflow,
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
  onParseError?: (detail: { filePath: string; reason: string }) => void,
): Promise<ReturnType<typeof readSpecContext> extends Promise<infer T> ? T : never> {
  let existing: Awaited<ReturnType<typeof readSpecContext>>;
  try {
    existing = await readSpecContext(specDirectory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputChannel?.appendLine(
      `[SpecViewer] readSpecContext failed for ${specDirectory}: ${msg} — rendering with in-memory backfill, NOT writing.`,
    );
    if (err instanceof SpecContextParseError) {
      onParseError?.({ filePath: err.filePath, reason: err.reason });
    }
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
   * Read `speckit.viewer.activityPanel` from VS Code settings as a boolean.
   * Defaults to `true` (shown). Tolerates a legacy tri-state string
   * (`'beta'`/`'on'` → `true`, `'off'` → `false`) until the settings migration
   * rewrites it.
   */
  private readActivityPanelEnabled(): boolean {
    const raw = vscode.workspace
      .getConfiguration('speckit.viewer')
      .get<unknown>('activityPanel', true);
    return coerceLegacyBoolean(raw, true);
  }

  /**
   * Whether to show the install banner in the Activity panel: the install-prompt
   * mode isn't `off` AND the companion spec-kit extension is missing. Installed
   * projects return `false` — no banner, no regression.
   */
  private computeShowInstallPrompt(): boolean {
    if (this.context.globalState.get<boolean>(ConfigKeys.globalState.installBannerDismissed, false)) {
      return false;
    }
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return shouldShowInstallPrompt(
      readInstallPromptEnabled(),
      root ? isCompanionInstalled(root) : false
    );
  }

  /**
   * Resolve the footer pipeline for a spec from its own workflow, mirroring the
   * sidebar (specExplorerProvider.resolveWorkflowSteps). Falls back to the default
   * pipeline when no workflow is persisted or resolution throws, so the footer
   * never renders empty.
   */
  private async resolveWorkflowSteps(specDir?: string): Promise<WorkflowStepConfig[]> {
    if (specDir) {
      try {
        const ctx = await getFeatureWorkflow(specDir, this.computeChangeRoot(specDir));
        if (ctx) {
          const wf = getWorkflow(ctx.workflow);
          if (wf) {
            const normalized = normalizeWorkflowConfig(wf);
            if (normalized.steps && normalized.steps.length > 0) {
              return normalized.steps;
            }
          }
        }
        const selected = await resolveWorkflow(specDir);
        if (selected) {
          const normalized = normalizeWorkflowConfig(selected);
          if (normalized.steps && normalized.steps.length > 0) {
            return normalized.steps;
          }
        }
      } catch {
        // fall through to the default pipeline
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
   * Re-read `.spec-context.json` and re-post a COMPLETE `viewerState` +
   * `navState` to the open viewer (markdown untouched). Fires on every
   * `.spec-context.json` change — post-action and external (FR-007). Uses the
   * same shared payload builder as the tab-switch path so the footer never
   * mixes a fresh viewerState with a stale partial navState, but skips
   * document-content, tasks.md, and staleness reads (none are used by
   * `viewerStateUpdated`). No-op when no panel is open.
   */
  public async refreshContextIfDisplaying(specContextPath: string): Promise<void> {
    const specDir = path.dirname(specContextPath);
    const instance = this.panels.get(specDir);
    if (!instance) return;

    try {
      const built = await this.buildViewerPayload(specDir, instance.state.currentDocument, {
        skipContentAndStaleness: true,
      });
      if (!built || !built.viewerState) return;
      instance.panel.webview.postMessage({
        type: 'viewerStateUpdated',
        viewerState: built.viewerState,
        navState: built.navState,
      });
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] refreshContextIfDisplaying failed: ${error}`,
      );
    }
  }

  /**
   * Surface a malformed `.spec-context.json` to the user and offer a one-click
   * reset. Non-blocking: the viewer has already rendered the read-only backfill;
   * dismissing the toast leaves the broken file untouched on disk.
   */
  private async promptResetMalformedContext(
    specDirectory: string,
    workflowName: string,
    detail: { filePath: string; reason: string },
  ): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      `Spec context is corrupt and could not be read: ${detail.reason} (${detail.filePath}). Reset backs the file up first.`,
      'Reset context',
    );
    if (choice !== 'Reset context') return;
    try {
      const specName = path.basename(specDirectory);
      const backupPath = await resetMalformedContext(
        specDirectory,
        { workflow: workflowName, specName, branch: specName },
        this.outputChannel,
      );
      vscode.window.showInformationMessage(
        `Spec context reset — original backed up to ${path.basename(backupPath)}.`,
      );
      await this.refreshContextIfDisplaying(path.join(specDirectory, SPEC_CONTEXT_FILENAME));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[SpecViewer] resetMalformedContext failed: ${msg}`);
      vscode.window.showErrorMessage(`Failed to reset spec context: ${msg}`);
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
      resolveWorkflowSteps: () => this.resolveWorkflowSteps(specDirectory),
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

      // Scan for available documents using the spec's resolved pipeline steps
      const steps = await this.resolveWorkflowSteps(specDirectory);
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
        await ensureSpecContext(specDirectory, workflowName, this.outputChannel, detail =>
          void this.promptResetMalformedContext(specDirectory, workflowName, detail),
        );
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

      // Staleness is I/O (filesystem probes); compute here after derived state.
      const stalenessMap = await computeStaleness(documents);
      const runInfo = this.deriveRunningStepInfo(derived.derivedStepHistory);

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
        this.readActivityPanelEnabled(),
        this.computeShowInstallPrompt(),
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
   * Resolve enhancement buttons for a document type from the customCommands
   * setting and the built-in optional SpecKit commands. The panel does not
   * read the workflow definition to build these — driving logic lives in the
   * commands, not the panel.
   */
  private resolveEnhancementButtons(
    docType: DocumentType,
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

    // Append built-in optional SpecKit command buttons for this tab, deduped
    // against the user's custom commands (which take precedence).
    buttons.push(...optionalCommandButtonsForTab(docType, seenCommands));

    return buttons;
  }

  /** Tab id of the in-flight step (for the active-step indicator), or null when idle. */
  private deriveRunningStepInfo(
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }> | undefined,
  ): { tab: string | null } {
    const running = findRunningStep(stepHistory);
    if (!running) {
      return { tab: null };
    }
    return { tab: mapStepToTab(running.step) || running.step };
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
      const built = await this.buildViewerPayload(specDirectory, documentType);
      if (!built) return;
      const { doc, content, navState, viewerState, featureCtx, derived } = built;
      const resolvedType = doc.type;

      // Fire step-complete notifications based on transitions in
      // derivedStepHistory (content-update path only).
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

      instance.state.currentDocument = resolvedType;
      instance.state.taskCompletionPercent = derived.taskCompletionPercent;
      instance.state.currentPhase = getPhaseNumber(resolvedType);

      const docLabel = doc.label || "Spec";
      instance.panel.title = `Spec: ${instance.state.specName} - ${docLabel}`;

      // Send content via message (no full HTML regeneration)
      const encodedContent = Buffer.from(content).toString("base64");
      this.postMessage(specDirectory, {
        type: "contentUpdated",
        content: encodedContent,
        documentType: resolvedType,
        specName: instance.state.specName,
        navState,
        viewerState,
      });

      this.outputChannel.appendLine(
        `[SpecViewer] Sent content update: ${instance.state.specName}/${resolvedType}`,
      );
    } catch (error) {
      this.outputChannel.appendLine(
        `[SpecViewer] Error sending content update: ${error}`,
      );
    }
  }

  /**
   * Build the COMPLETE webview payload (full `navState` + serialized
   * `viewerState`) for a spec directory + document. Both refresh paths —
   * `sendContentUpdateMessage` (contentUpdated) and `refreshContextIfDisplaying`
   * (viewerStateUpdated) — go through this single builder so their shapes can
   * never drift: the footer reads `viewerState` only, and no footer-affecting
   * message is ever a partial merged onto a stale snapshot (INV-3). Returns
   * `null` when the requested document can't be resolved.
   */
  private async buildViewerPayload(
    specDirectory: string,
    documentType: DocumentType,
    options?: {
      /**
       * When true, skips reading document content, `tasks.md`, and
       * recomputing the staleness map. Use for `viewerStateUpdated` refreshes
       * triggered by `.spec-context.json` changes: the message doesn't carry
       * `content`, so the extra disk I/O is unnecessary and increases the risk
       * of transient failures. Cached `taskCompletionPercent` and `specStatus`
       * are reused to keep navState self-consistent.
       */
      skipContentAndStaleness?: boolean;
    },
  ): Promise<{
    doc: SpecDocument;
    content: string;
    navState: NavState;
    viewerState: CoreViewerState | undefined;
    featureCtx: FeatureWorkflowContext | undefined;
    derived: PanelDerivedState;
  } | null> {
    const instance = this.panels.get(specDirectory);
    if (!instance) return null;

    // Tab-click resolution: honour the user's pick; only redirect when the
    // chosen core doc doesn't exist but a sub-spec under it does.
    const doc = resolveTabClickDocument(instance.state.availableDocuments, documentType);
    if (!doc) {
      this.outputChannel.appendLine(`[SpecViewer] Document not found: ${documentType}`);
      return null;
    }
    const resolvedType = doc.type;

    // Skip document + tasks reads for context-only refreshes (viewerStateUpdated).
    // These refreshes don't send content to the webview, so the I/O is wasted work
    // that adds latency and transient-failure surface area.
    let content = "";
    let tasksContent = "";
    if (!options?.skipContentAndStaleness) {
      ({ content } = await this.readDocumentContent(doc));
      tasksContent = await this.readTasksContent(doc, instance.state.availableDocuments, content);
    }

    // Tolerate transient read failures so a render pass during a concurrent
    // CLI write degrades gracefully rather than crashing the whole update.
    const changeRoot = instance.state.changeRoot;
    let featureCtx: FeatureWorkflowContext | undefined;
    try {
      featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
    } catch (err) {
      this.outputChannel.appendLine(
        `[SpecViewer] buildViewerPayload: getFeatureWorkflow failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const enhancementButtons = this.resolveEnhancementButtons(resolvedType);

    const derived = computePanelDerivedState(
      { documents: instance.state.availableDocuments, doc, tasksContent, featureCtx },
      enhancementButtons,
    );

    // For context-only refreshes, reuse the cached task-completion percent and
    // re-derive specStatus from it so navState stays self-consistent without
    // re-reading tasks.md.
    const effectiveTaskPct = options?.skipContentAndStaleness
      ? instance.state.taskCompletionPercent
      : derived.taskCompletionPercent;
    const effectiveSpecStatus = options?.skipContentAndStaleness
      ? resolveSpecStatus(featureCtx, effectiveTaskPct)
      : derived.specStatus;

    // Skip staleness recompute for context-only refreshes; the UI only updates
    // staleness indicators on full content refreshes (tab switches, file saves).
    const stalenessMap = options?.skipContentAndStaleness
      ? {}
      : await computeStaleness(instance.state.availableDocuments);

    const runInfo = this.deriveRunningStepInfo(derived.derivedStepHistory);

    const navState: NavState = {
      coreDocs: derived.coreDocs,
      relatedDocs: derived.relatedDocs,
      currentDoc: resolvedType,
      workflowPhase: derived.workflowPhase,
      taskCompletionPercent: effectiveTaskPct,
      isViewingRelatedDoc: derived.isViewingRelatedDoc,
      enhancementButtons,
      stalenessMap,
      specStatus: effectiveSpecStatus,
      currentTask: featureCtx?.currentTask ?? null,
      activeStep: runInfo.tab,
      stepHistory: derived.stepHistoryByTab,
      badgeText: derived.badgeText,
      createdDate: derived.createdDate,
      lastUpdatedDate: derived.lastUpdatedDate,
      specContextName: featureCtx?.specName ?? deriveSpecName(specDirectory),
      branch: featureCtx?.workingBranch ?? featureCtx?.branch ?? null,
      currentStep: featureCtx?.currentStep ?? resolvedType ?? null,
      filePath: doc?.filePath ?? null,
      docTypeLabel: getDocTypeLabel(featureCtx?.currentStep ?? resolvedType),
      activityPanelEnabled: this.readActivityPanelEnabled(),
      // Must be re-sent on every update: the webview replaces the whole navState
      // object, so omitting this would make the relocated Activity-panel banner
      // (#255) vanish on the first content/spec-context refresh after load.
      showInstallPrompt: this.computeShowInstallPrompt(),
    };

    // Derive ViewerState from the canonical .spec-context.json — the footer's
    // sole input. The run-step artifact-ready flag is the only I/O-derived
    // field, computed above and injected into the otherwise-pure derivation.
    let viewerState: CoreViewerState | undefined;
    try {
      let specCtx = await readSpecContext(specDirectory);
      if (specCtx) {
        specCtx = await reconcileAndPersist(specDirectory, specCtx, (m) => this.outputChannel.appendLine(m));
        const wfSteps = await this.resolveWorkflowSteps(specDirectory);
        // Custom workflows whose commands don't emit capture context get their
        // progression reconstructed from the step output files on disk, so the
        // forward button lights up. No-op for built-in / capturing workflows.
        specCtx = synthesizeCustomProgress(specCtx, wfSteps, (s) =>
          stepHasOutput(specDirectory, s)
        );
        const active: StepName = STEP_NAMES.includes(specCtx.currentStep as StepName)
          ? (specCtx.currentStep as StepName)
          : (specCtx.currentStep as StepName) || 'specify';
        const derivedVs = deriveViewerState(specCtx, active, wfSteps);
        // Living-specs content is filesystem-derived, so it's enriched here at
        // the provider seam rather than inside the pure derivation.
        if (derivedVs.livingSpecs) {
          const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (wsRoot) {
            derivedVs.livingSpecs = enrichLivingSpecs(
              derivedVs.livingSpecs,
              wsRoot,
              path.join(specDirectory, "spec.md")
            );
          }
        }
        viewerState = {
          ...derivedVs,
          footer: derivedVs.footer.map(a => ({
            id: a.id,
            label: a.label,
            scope: a.scope,
            tooltip: a.tooltip,
            // visibleWhen stripped at serialization boundary
          })) as CoreViewerState['footer'],
        };
      }
    } catch (error) {
      this.outputChannel.appendLine(`[SpecViewer] deriveViewerState failed: ${error}`);
    }

    return { doc, content, navState, viewerState, featureCtx, derived };
  }
}

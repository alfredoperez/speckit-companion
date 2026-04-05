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
  SpecStatus,
  SpecViewerState,
} from "./types";
import { getDocumentTypeFromPath, getSpecDirectoryFromPath } from "./utils";
import { ConfigKeys, SpecStatuses } from "../../core/constants";
import type { CustomCommandConfig } from "../../core/types/config";
import { deriveChangeRoot } from "../../core/specDirectoryResolver";
import {
  DEFAULT_WORKFLOW,
  getFeatureWorkflow,
  getOrSelectWorkflow,
  getWorkflow,
  normalizeWorkflowConfig,
} from "../workflows";
import type { WorkflowStepConfig } from "../workflows/types";

// Re-export utility functions for external use
export {
  getDocumentTypeFromPath,
  getSpecDirectoryFromPath,
  isSpecDocument,
} from "./utils";

/**
 * Panel instance data for multi-panel support
 */
interface PanelInstance {
  panel: vscode.WebviewPanel;
  state: SpecViewerState;
  debounceTimer: NodeJS.Timeout | undefined;
}

/**
 * Provides the spec viewer webview panel for viewing spec documents.
 * Supports multiple panels - one per spec directory.
 */
export class SpecViewerProvider {
  /** Map of spec directory to panel instance */
  private panels: Map<string, PanelInstance> = new Map();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

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

    // 2. No persisted context — auto-select default and persist it
    const selected = await getOrSelectWorkflow(specDirectory);
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
    };

    // Store in map
    this.panels.set(specDirectory, instance);

    // Handle disposal
    panel.onDidDispose(() => {
      this.outputChannel.appendLine(
        `[SpecViewer] Panel disposed for ${specDirectory}`,
      );
      if (instance.debounceTimer) {
        clearTimeout(instance.debounceTimer);
      }
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
      resolveWorkflowSteps: dir => {
        const inst = this.getInstance(dir);
        return this.resolveWorkflowSteps(dir, inst?.state.changeRoot);
      },
      executeInTerminal: async (prompt: string) => {
        const inst = this.getInstance(specDirectory);
        inst?.panel.webview.postMessage({ type: 'actionToast', message: 'Opening terminal…' });
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

      // Find the requested document (or fallback to first available)
      let doc = documents.find(d => d.type === documentType);
      if (!doc) {
        // Type name mismatch (e.g. "spec" vs "specify") — try matching by file name
        const requestedFile = `${documentType}.md`;
        doc = documents.find(d => d.isCore && d.fileName === requestedFile);
      }
      if (!doc) {
        // Try to find first existing core document
        doc = documents.find(d => d.isCore && d.exists);
      }
      if (!doc) {
        doc = documents[0]; // Fallback to first document
      }

      // If the core doc doesn't exist but sub-specs do, redirect to the first sub-spec
      if (doc && !doc.exists && doc.isCore) {
        const firstSubSpec = documents.find(
          d => d.parentStep === doc!.type && d.exists,
        );
        if (firstSubSpec) {
          doc = firstSubSpec;
        }
      }

      // Read content
      let content = "";
      let emptyMessage = "";

      if (doc?.exists) {
        try {
          const uri = vscode.Uri.file(doc.filePath);
          const data = await vscode.workspace.fs.readFile(uri);
          content = Buffer.from(data).toString("utf-8");
        } catch (error) {
          this.outputChannel.appendLine(
            `[SpecViewer] Error reading ${doc.filePath}: ${error}`,
          );
          emptyMessage = `Error reading file: ${error}`;
        }
      } else {
        // Get empty state message
        if (doc?.type in EMPTY_STATE_MESSAGES) {
          emptyMessage = EMPTY_STATE_MESSAGES[doc.type as CoreDocumentType];
        } else {
          emptyMessage = DEFAULT_EMPTY_MESSAGE;
        }
      }

      // Always try to read tasks.md for completion status
      let tasksContent = "";
      if (doc?.type === CORE_DOCUMENTS.TASKS) {
        tasksContent = content;
      } else {
        const tasksDoc = documents.find(d => d.type === CORE_DOCUMENTS.TASKS);
        if (tasksDoc && tasksDoc.exists) {
          try {
            const uri = vscode.Uri.file(tasksDoc.filePath);
            const data = await vscode.workspace.fs.readFile(uri);
            tasksContent = Buffer.from(data).toString("utf-8");
          } catch (error) {
            this.outputChannel.appendLine(
              `[SpecViewer] Error reading tasks.md for completion: ${error}`,
            );
          }
        }
      }

      // Calculate phases
      const phases = calculatePhases(
        documents,
        doc?.type || CORE_DOCUMENTS.SPEC,
        tasksContent,
      );
      const currentPhase = getPhaseNumber(doc?.type || CORE_DOCUMENTS.SPEC);
      const taskCompletionPercent = calculateTaskCompletion(
        tasksContent,
        CORE_DOCUMENTS.TASKS,
      );

      // Update state
      instance.state = {
        specName,
        specDirectory,
        changeRoot,
        currentDocument: doc?.type || CORE_DOCUMENTS.SPEC,
        availableDocuments: documents,
        lastUpdated: Date.now(),
        phases,
        currentPhase,
        taskCompletionPercent,
      };

      // Update panel title
      const docLabel = doc?.label || "Spec";
      instance.panel.title = `Spec: ${specName} - ${docLabel}`;

      // Determine spec status for conditional UI
      const featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
      let specStatus: SpecStatus;
      if (featureCtx?.status === SpecStatuses.ARCHIVED || featureCtx?.currentStep === SpecStatuses.ARCHIVED || featureCtx?.currentStep === "done") {
        specStatus = SpecStatuses.ARCHIVED;
      } else if (featureCtx?.status === SpecStatuses.COMPLETED) {
        specStatus = SpecStatuses.COMPLETED;
      } else if (taskCompletionPercent === 100) {
        specStatus = SpecStatuses.TASKS_DONE;
      } else {
        specStatus = SpecStatuses.ACTIVE;
      }

      // Resolve enhancement buttons from customCommands
      const enhancementButtons = this.resolveEnhancementButtons(doc?.type || CORE_DOCUMENTS.SPEC);

      // Compute staleness for workflow documents
      const stalenessMap = await computeStaleness(documents);

      // Compute context-driven dates
      const createdDate = computeCreatedDate(featureCtx?.stepHistory);
      const lastUpdatedDate = computeLastUpdatedDate(featureCtx?.stepHistory, featureCtx?.updated);

      // Generate and set HTML
      instance.panel.webview.html = generateHtml(
        instance.panel.webview,
        this.context.extensionUri,
        content,
        emptyMessage,
        documents,
        doc?.type || CORE_DOCUMENTS.SPEC,
        specName,
        phases,
        taskCompletionPercent,
        specStatus,
        enhancementButtons,
        stalenessMap,
        mapSddStepToTab(featureCtx?.step),
        computeBadgeText(featureCtx),
        createdDate,
        lastUpdatedDate,
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
   */
  private resolveEnhancementButtons(
    docType: DocumentType,
  ): EnhancementButton[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const rawCommands = config.get<Array<CustomCommandConfig | string>>("customCommands", []);

    const buttons: EnhancementButton[] = [];
    for (const entry of rawCommands) {
      if (typeof entry === "string") continue;
      const step = entry.step || "all";
      if (step !== docType && step !== "all") continue;

      const title = entry.title || entry.name;
      if (!title) continue;

      const command = entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
      if (!command) continue;

      buttons.push({
        label: title,
        command,
        icon: "⚡",
        tooltip: entry.tooltip || title,
      });
    }

    return buttons;
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
      // Find the requested document
      let doc = instance.state.availableDocuments.find(
        d => d.type === documentType,
      );
      if (!doc) {
        this.outputChannel.appendLine(
          `[SpecViewer] Document not found: ${documentType}`,
        );
        return;
      }

      // If the core doc doesn't exist but sub-specs do, redirect to the first sub-spec
      if (!doc.exists && doc.isCore) {
        const firstSubSpec = instance.state.availableDocuments.find(
          d => d.parentStep === documentType && d.exists,
        );
        if (firstSubSpec) {
          doc = firstSubSpec;
          documentType = firstSubSpec.type;
        }
      }

      // Read content
      let content = "";
      if (doc.exists) {
        try {
          const uri = vscode.Uri.file(doc.filePath);
          const data = await vscode.workspace.fs.readFile(uri);
          content = Buffer.from(data).toString("utf-8");
        } catch (error) {
          this.outputChannel.appendLine(
            `[SpecViewer] Error reading ${doc.filePath}: ${error}`,
          );
        }
      }

      // Always try to read tasks.md for completion status
      let tasksContent = "";
      if (documentType === CORE_DOCUMENTS.TASKS) {
        tasksContent = content;
      } else {
        const tasksDoc = instance.state.availableDocuments.find(
          d => d.type === CORE_DOCUMENTS.TASKS,
        );
        if (tasksDoc && tasksDoc.exists) {
          try {
            const uri = vscode.Uri.file(tasksDoc.filePath);
            const data = await vscode.workspace.fs.readFile(uri);
            tasksContent = Buffer.from(data).toString("utf-8");
          } catch (error) {
            this.outputChannel.appendLine(
              `[SpecViewer] Error reading tasks.md for completion: ${error}`,
            );
          }
        }
      }

      // Calculate task completion for tasks doc
      const taskCompletionPercent = calculateTaskCompletion(
        tasksContent,
        CORE_DOCUMENTS.TASKS,
      );

      // Build navigation state
      const coreDocs = instance.state.availableDocuments.filter(
        d => d.category === "core",
      );
      const relatedDocs = instance.state.availableDocuments.filter(
        d => d.category === "related",
      );
      const coreDocTypes = coreDocs.map(d => d.type);
      const isViewingRelatedDoc = !coreDocTypes.includes(documentType);
      const workflowPhase = calculateWorkflowPhase(coreDocs);

      // Calculate footer state (same logic as generator.ts)
      let showApproveButton = false;
      let approveText = "";

      let currentIndex = coreDocs.findIndex(d => d.type === documentType);
      if (currentIndex < 0 && isViewingRelatedDoc) {
        const parentStep = relatedDocs.find(d => d.type === documentType)?.parentStep;
        if (parentStep) {
          currentIndex = coreDocs.findIndex(d => d.type === parentStep);
        }
      }
      if (currentIndex >= 0 && currentIndex < coreDocs.length - 1) {
        const nextDoc = coreDocs[currentIndex + 1];
        if (!nextDoc.exists) {
          showApproveButton = true;
          approveText = nextDoc.label;
        }
      } else if (currentIndex === coreDocs.length - 1) {
        // Last step: show implement button if not complete
        if (taskCompletionPercent < 100) {
          showApproveButton = true;
          approveText = "Implement";
        }
      }

      // Determine spec status for lifecycle buttons
      const changeRoot = instance.state.changeRoot;
      const featureCtx = await getFeatureWorkflow(specDirectory, changeRoot);
      let specStatus: string;
      if (featureCtx?.status === SpecStatuses.ARCHIVED || featureCtx?.currentStep === SpecStatuses.ARCHIVED || featureCtx?.currentStep === "done") {
        specStatus = SpecStatuses.ARCHIVED;
      } else if (featureCtx?.status === SpecStatuses.COMPLETED) {
        specStatus = SpecStatuses.COMPLETED;
      } else if (taskCompletionPercent === 100) {
        specStatus = SpecStatuses.TASKS_DONE;
      } else {
        specStatus = SpecStatuses.ACTIVE;
      }

      // Resolve enhancement buttons from customCommands
      const enhancementButtons = this.resolveEnhancementButtons(documentType);

      // Compute staleness for workflow documents
      const stalenessMap = await computeStaleness(instance.state.availableDocuments);

      const navState: NavState = {
        coreDocs,
        relatedDocs,
        currentDoc: documentType,
        workflowPhase,
        taskCompletionPercent,
        isViewingRelatedDoc,
        footerState: {
          showApproveButton,
          approveText,
          enhancementButtons,
          specStatus,
        },
        enhancementButtons,
        stalenessMap,
        specStatus,
        currentTask: featureCtx?.task ?? null,
        activeStep: mapSddStepToTab(featureCtx?.step),
        badgeText: computeBadgeText(featureCtx),
        createdDate: computeCreatedDate(featureCtx?.stepHistory),
        lastUpdatedDate: computeLastUpdatedDate(featureCtx?.stepHistory, featureCtx?.updated),
      };

      // Update internal state
      instance.state.currentDocument = documentType;
      instance.state.taskCompletionPercent = taskCompletionPercent;
      instance.state.currentPhase = getPhaseNumber(documentType);

      // Update panel title
      const docLabel = doc.label || "Spec";
      instance.panel.title = `Spec: ${instance.state.specName} - ${docLabel}`;

      // Send content via message (no full HTML regeneration)
      const encodedContent = Buffer.from(content).toString("base64");
      this.postMessage(specDirectory, {
        type: "contentUpdated",
        content: encodedContent,
        documentType,
        specName: instance.state.specName,
        navState,
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

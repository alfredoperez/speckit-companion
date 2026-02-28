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
import {
  calculatePhases,
  calculateTaskCompletion,
  calculateWorkflowPhase,
  getPhaseNumber,
} from "./phaseCalculation";
import {
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
import { ConfigKeys } from "../../core/constants";
import type { CustomCommandConfig } from "../../core/types/config";

// Re-export utility functions for external use
export {
  getDocumentTypeFromPath,
  getSpecDirectoryFromPath,
  isSpecDocument,
} from "./utils";

/**
 * Extract spec status from document content
 * Status is parsed from spec metadata (e.g., "**Status**: Draft")
 */
function extractSpecStatus(content: string): SpecStatus {
  const patterns = [
    /\*\*Status\*\*:\s*([\w\s-]+)/i,
    /Status:\s*([\w\s-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const status = match[1].toLowerCase().trim();
      if (status.includes("completed") || status === "done") {
        return "spec-completed";
      }
      if (status.includes("progress")) {
        return "in-progress";
      }
    }
  }
  return "draft";
}

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
   * Show the spec viewer with the specified document
   */
  public async show(filePath: string): Promise<void> {
    const specDirectory = getSpecDirectoryFromPath(filePath);
    const documentType = getDocumentTypeFromPath(filePath);

    this.outputChannel.appendLine(
      `[SpecViewer] Opening ${documentType} from ${specDirectory}`,
    );

    // Check if panel already exists for this spec
    const existingInstance = this.panels.get(specDirectory);
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
    await this.updateContent(
      instance.state.specDirectory,
      instance.state.currentDocument,
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
      // Scan for available documents
      const documents = await scanDocuments(specDirectory, this.outputChannel);
      const specName = path.basename(specDirectory);

      // Find the requested document (or fallback to first available)
      let doc = documents.find(d => d.type === documentType);
      if (!doc) {
        // Try to find first existing core document
        doc = documents.find(d => d.isCore && d.exists);
      }
      if (!doc) {
        doc = documents[0]; // Fallback to first document
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
      if (doc?.type === "tasks") {
        tasksContent = content;
      } else {
        const tasksDoc = documents.find(d => d.type === "tasks");
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
        doc?.type || "spec",
        tasksContent,
      );
      const currentPhase = getPhaseNumber(doc?.type || "spec");
      const taskCompletionPercent = calculateTaskCompletion(
        tasksContent,
        "tasks",
      );

      // Update state
      instance.state = {
        specName,
        specDirectory,
        currentDocument: doc?.type || "spec",
        availableDocuments: documents,
        lastUpdated: Date.now(),
        phases,
        currentPhase,
        taskCompletionPercent,
      };

      // Update panel title
      const docDisplayName = doc?.displayName || "Spec";
      instance.panel.title = `Spec: ${specName} - ${docDisplayName}`;

      // Extract spec status for conditional UI
      // Use task completion to determine completed status when tasks are 100% done
      let specStatus = extractSpecStatus(content);
      if (taskCompletionPercent === 100) {
        specStatus = "spec-completed";
      }

      // Resolve enhancement button from customCommands
      const enhancementButtons = this.resolveEnhancementButtons(doc?.type || "spec");
      const enhancementButton = enhancementButtons[0] || null;

      // Generate and set HTML
      instance.panel.webview.html = generateHtml(
        instance.panel.webview,
        this.context.extensionUri,
        content,
        emptyMessage,
        documents,
        doc?.type || "spec",
        specName,
        phases,
        taskCompletionPercent,
        specStatus,
        enhancementButton,
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
    if (docType !== "spec" && docType !== "plan" && docType !== "tasks") {
      return [];
    }

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
      const doc = instance.state.availableDocuments.find(
        d => d.type === documentType,
      );
      if (!doc) {
        this.outputChannel.appendLine(
          `[SpecViewer] Document not found: ${documentType}`,
        );
        return;
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
      if (documentType === "tasks") {
        tasksContent = content;
      } else {
        const tasksDoc = instance.state.availableDocuments.find(
          d => d.type === "tasks",
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
        "tasks",
      );

      // Build navigation state
      const coreDocs = instance.state.availableDocuments.filter(
        d => d.category === "core",
      );
      const relatedDocs = instance.state.availableDocuments.filter(
        d => d.category === "related",
      );
      const isViewingRelatedDoc = !["spec", "plan", "tasks"].includes(
        documentType,
      );
      const workflowPhase = calculateWorkflowPhase(coreDocs);

      // Calculate footer state (same logic as generator.ts)
      const planExists = coreDocs.find(d => d.type === "plan")?.exists ?? false;
      const tasksExists = coreDocs.find(d => d.type === "tasks")?.exists ?? false;

      let showApproveButton = false;
      let approveText = "";

      if (documentType === "spec") {
        if (!planExists) {
          showApproveButton = true;
          approveText = "Generate Plan";
        }
      } else if (documentType === "plan") {
        if (!tasksExists) {
          showApproveButton = true;
          approveText = "Generate Tasks";
        }
      } else if (documentType === "tasks") {
        if (taskCompletionPercent < 100) {
          showApproveButton = true;
          approveText = "Implement Tasks";
        }
      }

      // Resolve enhancement button from customCommands
      const enhancementButtons = this.resolveEnhancementButtons(documentType);
      const enhancementButton = enhancementButtons[0] || null;

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
          enhancementButton,
        },
        enhancementButton,
      };

      // Update internal state
      instance.state.currentDocument = documentType;
      instance.state.taskCompletionPercent = taskCompletionPercent;
      instance.state.currentPhase = getPhaseNumber(documentType);

      // Update panel title
      const docDisplayName = doc.displayName || "Spec";
      instance.panel.title = `Spec: ${instance.state.specName} - ${docDisplayName}`;

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

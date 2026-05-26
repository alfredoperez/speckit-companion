/**
 * Unit tests for messageHandlers — T005
 * Verifies that handleAddComment resolves sourceDoc via fileName fallback
 * when availableDocuments has type='specify' instead of type='spec'.
 */

import * as vscode from "vscode";
import type { MessageHandlerDependencies } from "../../../src/features/spec-viewer/messageHandlers";
import { createMessageHandlers } from "../../../src/features/spec-viewer/messageHandlers";
import type { SpecViewerState } from "../../../src/features/spec-viewer/types";

// Mock heavy dependencies that write to disk
jest.mock("../../../src/features/specs/specContextReader", () => ({
  SPEC_CONTEXT_FILENAME: ".spec-context.json",
  readSpecContext: jest.fn().mockResolvedValue({
    workflow: "speckit-companion",
    specName: "test",
    branch: "main",
    currentStep: "specify",
    status: "draft",
    stepHistory: {},
    transitions: [],
    reviewComments: [],
  }),
}));

jest.mock("../../../src/features/specs/specContextWriter", () => ({
  updateSpecContext: jest.fn().mockResolvedValue(undefined),
}));

const SPEC_DIR = "/tmp/test-spec";
const SPEC_FILE_PATH = `${SPEC_DIR}/spec.md`;

function makeSpecDocument(
  type: string,
  fileName: string,
  filePath: string,
  isCore: boolean,
) {
  return {
    type,
    fileName,
    filePath,
    isCore,
    exists: true,
    category: "core" as const,
  };
}

function makeDeps(
  availableDocuments: ReturnType<typeof makeSpecDocument>[],
): MessageHandlerDependencies {
  const state: Partial<SpecViewerState> = {
    availableDocuments: availableDocuments as any,
    changeRoot: null,
  };
  return {
    getInstance: () => ({
      state: state as SpecViewerState,
      debounceTimer: undefined,
    }),
    updateContent: jest.fn().mockResolvedValue(undefined),
    sendContentUpdateMessage: jest.fn().mockResolvedValue(undefined),
    refreshContextIfDisplaying: jest.fn().mockResolvedValue(undefined),
    resolveWorkflowSteps: jest.fn().mockResolvedValue([]),
    executeInTerminal: jest.fn().mockResolvedValue(undefined),
    outputChannel: { appendLine: jest.fn() } as any,
    context: {} as any,
  };
}

describe("handleAddComment — sourceDoc resolution (T005)", () => {
  const readFileMock = vscode.workspace.fs.readFile as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    readFileMock.mockResolvedValue(
      new Uint8Array(Buffer.from("# Spec\n\nSome content\n")),
    );
  });

  it('resolves sourceDoc via fileName when availableDocuments has type="specify" and doc="spec"', async () => {
    // Arrange: SDD workflow — spec doc has type='specify', not 'spec'
    const docs = [makeSpecDocument("specify", "spec.md", SPEC_FILE_PATH, true)];
    const deps = makeDeps(docs);
    const handler = createMessageHandlers(SPEC_DIR, deps);

    // Act: send addComment for doc='spec'
    await handler({
      type: "addComment",
      id: "comment-1",
      doc: "spec",
      lineNum: 3,
      lineContent: "Some content",
      comment: "Needs more detail",
    } as any);

    // Assert: readFile was called with the spec.md path (sourceDoc was resolved)
    expect(readFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: SPEC_FILE_PATH }),
    );
  });

  it('resolves sourceDoc via type match when availableDocuments has type="spec" and doc="spec"', async () => {
    // Arrange: standard workflow — spec doc has type='spec'
    const docs = [makeSpecDocument("spec", "spec.md", SPEC_FILE_PATH, true)];
    const deps = makeDeps(docs);
    const handler = createMessageHandlers(SPEC_DIR, deps);

    // Act
    await handler({
      type: "addComment",
      id: "comment-2",
      doc: "spec",
      lineNum: 1,
      lineContent: "# Spec",
      comment: "Good heading",
    } as any);

    // Assert: readFile called — sourceDoc found by type match
    expect(readFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: SPEC_FILE_PATH }),
    );
  });

  it("does not call readFile when no matching sourceDoc exists", async () => {
    // Arrange: availableDocuments has no matching entry for 'spec'
    const docs = [
      makeSpecDocument("plan", "plan.md", `${SPEC_DIR}/plan.md`, true),
    ];
    const deps = makeDeps(docs);
    const handler = createMessageHandlers(SPEC_DIR, deps);

    // Act
    await handler({
      type: "addComment",
      id: "comment-3",
      doc: "spec",
      lineNum: 1,
      lineContent: "# Spec",
      comment: "Comment without sourceDoc",
    } as any);

    // Assert: readFile NOT called — no sourceDoc resolved
    expect(readFileMock).not.toHaveBeenCalled();
  });
});

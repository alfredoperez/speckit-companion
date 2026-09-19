/**
 * Unit tests for currentDoc() — T002
 * Verifies that navState.currentDoc values are mapped to the correct CoreDocumentType.
 */

import { navState } from "../../../webview/src/spec-viewer/signals";

// Must import after mocking signals (or import the function after setting navState)
import { currentDoc } from "../../../webview/src/spec-viewer/editor/currentDoc";

function setCurrentDoc(value: string | undefined): void {
  if (value === undefined) {
    navState.value = null;
  } else {
    navState.value = { currentDoc: value } as any;
  }
}

describe("currentDoc()", () => {
  afterEach(() => {
    navState.value = null;
  });

  it('returns "spec" when navState.currentDoc is "spec"', () => {
    setCurrentDoc("spec");
    expect(currentDoc()).toBe("spec");
  });

  it('returns "spec" when navState.currentDoc is "specify" (workflow step alias)', () => {
    setCurrentDoc("specify");
    expect(currentDoc()).toBe("spec");
  });

  it('returns "plan" when navState.currentDoc is "plan"', () => {
    setCurrentDoc("plan");
    expect(currentDoc()).toBe("plan");
  });

  it('returns "tasks" when navState.currentDoc is "tasks"', () => {
    setCurrentDoc("tasks");
    expect(currentDoc()).toBe("tasks");
  });

  it("returns null when navState is null", () => {
    setCurrentDoc(undefined);
    expect(currentDoc()).toBeNull();
  });

  it("passes non-core doc identifiers through verbatim", () => {
    setCurrentDoc("research");
    expect(currentDoc()).toBe("research");
  });

  it("passes nested doc paths through verbatim", () => {
    setCurrentDoc("checklists/requirements");
    expect(currentDoc()).toBe("checklists/requirements");
  });
});

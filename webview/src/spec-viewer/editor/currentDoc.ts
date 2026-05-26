import { navState } from "../signals";
import type { CoreDocumentType } from "../types";

/**
 * The core document currently being viewed, or null when viewing a related /
 * non-core doc (inline comments only apply to spec/plan/tasks).
 */
export function currentDoc(): CoreDocumentType | null {
  const d = navState.value?.currentDoc;
  if (d === "spec" || d === "specify") return "spec";
  if (d === "plan" || d === "tasks") return d;
  return null;
}

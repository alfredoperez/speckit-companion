import { navState } from "../signals";
import type { DocumentType } from "../types";

/**
 * The document currently being viewed, or null when nothing is selected.
 *
 * The SDD workflow uses step name `specify` for what is, in storage, the
 * `spec` document — alias it so comments persist under a single canonical
 * key. All other doc identifiers (core or non-core) pass through verbatim
 * so persistence works on `data-model`, `research`,
 * `checklists/requirements`, etc.
 */
export function currentDoc(): DocumentType | null {
  const d = navState.value?.currentDoc;
  if (!d) return null;
  if (d === "specify") return "spec";
  return d;
}

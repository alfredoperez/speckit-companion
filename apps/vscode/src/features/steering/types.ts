/**
 * SpecKit Files Types
 *
 * TypeScript interfaces for SpecKit file management in the steering view.
 * These types define the data structures used to represent and
 * manipulate SpecKit configuration files.
 *
 * @feature 005-speckit-views-enhancement
 */

/**
 * Classification of SpecKit file types
 */
export type SpecKitFileType = 'constitution' | 'script' | 'template';

/**
 * Represents an individual SpecKit file
 */
export interface SpecKitFile {
  /** File name without path (e.g., "setup-plan.sh") */
  name: string;

  /** Absolute file system path */
  path: string;

  /** Classification of the file */
  type: SpecKitFileType;

  /** Optional relative path for display (e.g., ".specify/scripts/bash/setup-plan.sh") */
  description?: string;
}

/**
 * Aggregated result from scanning .specify/ directory
 */
export interface SpecKitFilesResult {
  /** Constitution file or null if not found */
  constitution: SpecKitFile | null;

  /** Array of script files from .specify/scripts/ */
  scripts: SpecKitFile[];

  /** Array of template files from .specify/templates/ */
  templates: SpecKitFile[];
}

/**
 * Tree view context values for SpecKit items
 * Used for routing in getChildren() and enabling context menus
 */
export const SPECKIT_CONTEXT_VALUES = {
  /** Main SpecKit Files header (collapsible) */
  HEADER: 'speckit-header',

  /** Constitution file item */
  CONSTITUTION: 'speckit-constitution',

  /** Scripts category header (collapsible) */
  SCRIPTS_CATEGORY: 'speckit-scripts-category',

  /** Individual script file item */
  SCRIPT: 'speckit-script',

  /** Templates category header (collapsible) */
  TEMPLATES_CATEGORY: 'speckit-templates-category',

  /** Individual template file item */
  TEMPLATE: 'speckit-template',
} as const;

export type SpecKitContextValue = typeof SPECKIT_CONTEXT_VALUES[keyof typeof SPECKIT_CONTEXT_VALUES];

/**
 * Icon mappings for SpecKit items
 * Maps context values to VS Code ThemeIcon names
 */
export const SPECKIT_ICONS: Record<SpecKitContextValue, string> = {
  [SPECKIT_CONTEXT_VALUES.HEADER]: 'seedling',
  [SPECKIT_CONTEXT_VALUES.CONSTITUTION]: 'law',
  [SPECKIT_CONTEXT_VALUES.SCRIPTS_CATEGORY]: 'code',
  [SPECKIT_CONTEXT_VALUES.SCRIPT]: 'terminal',
  [SPECKIT_CONTEXT_VALUES.TEMPLATES_CATEGORY]: 'note',
  [SPECKIT_CONTEXT_VALUES.TEMPLATE]: 'file',
};

/**
 * Path constants for SpecKit directory structure
 */
export const SPECKIT_PATHS = {
  /** Base SpecKit directory */
  BASE: '.specify',

  /** Constitution file path (relative to workspace) */
  CONSTITUTION: '.specify/memory/constitution.md',

  /** Scripts directory */
  SCRIPTS_DIR: '.specify/scripts',

  /** Templates directory */
  TEMPLATES_DIR: '.specify/templates',
} as const;

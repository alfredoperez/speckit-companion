/**
 * Steering Explorer Provider Contracts
 *
 * TypeScript interfaces defining the contract for SteeringExplorerProvider
 * methods that will be added or modified for SpecKit files support.
 *
 * @feature 001-speckit-views-enhancement
 * @date 2026-01-02
 */

import type { SpecKitFilesResult, SpecKitFile } from './speckit-files';

/**
 * Extended interface for SteeringExplorerProvider
 * Defines new methods for SpecKit file support
 */
export interface ISpecKitFilesProvider {
  /**
   * Scans the .specify/ directory for SpecKit files
   *
   * @returns Promise resolving to aggregated SpecKit files
   *
   * @example
   * const files = await provider.getSpecKitFiles();
   * if (files.constitution) {
   *   // Show constitution in tree
   * }
   */
  getSpecKitFiles(): Promise<SpecKitFilesResult>;

  /**
   * Checks if SpecKit is initialized in the current workspace
   *
   * @returns true if .specify/ directory exists with content
   */
  hasSpecKitFiles(): Promise<boolean>;
}

/**
 * Tree item configuration for SpecKit categories
 */
export interface SpecKitCategoryConfig {
  /** Display label */
  label: string;

  /** Context value for routing */
  contextValue: string;

  /** VS Code ThemeIcon name */
  icon: string;

  /** Tooltip text */
  tooltip: string;

  /** Whether this category has children */
  hasChildren: boolean;
}

/**
 * Configuration for all SpecKit categories
 */
export const SPECKIT_CATEGORIES: Record<string, SpecKitCategoryConfig> = {
  header: {
    label: 'SpecKit Files',
    contextValue: 'speckit-header',
    icon: 'law',
    tooltip: 'SpecKit project configuration files',
    hasChildren: true,
  },
  constitution: {
    label: 'Constitution',
    contextValue: 'speckit-constitution',
    icon: 'law',
    tooltip: 'Project principles and guidelines',
    hasChildren: false,
  },
  scriptsCategory: {
    label: 'Scripts',
    contextValue: 'speckit-scripts-category',
    icon: 'code',
    tooltip: 'SpecKit automation scripts',
    hasChildren: true,
  },
  templatesCategory: {
    label: 'Templates',
    contextValue: 'speckit-templates-category',
    icon: 'note',
    tooltip: 'SpecKit document templates',
    hasChildren: true,
  },
};

/**
 * File scanner configuration
 */
export interface FileScannerConfig {
  /** Base directory to scan */
  basePath: string;

  /** File extension filter (e.g., '.md', '.sh') */
  extension?: string;

  /** Whether to scan subdirectories */
  recursive: boolean;
}

/**
 * Scanner configurations for each SpecKit file type
 */
export const FILE_SCANNER_CONFIGS: Record<string, FileScannerConfig> = {
  constitution: {
    basePath: '.specify/memory',
    extension: '.md',
    recursive: false,
  },
  scripts: {
    basePath: '.specify/scripts',
    recursive: true,
  },
  templates: {
    basePath: '.specify/templates',
    extension: '.md',
    recursive: false,
  },
};

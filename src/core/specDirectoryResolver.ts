import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigKeys } from './constants';

export interface SpecDirectoryInfo {
    name: string;
    path: string;
}

/**
 * Check if a pattern contains glob wildcards
 */
function hasGlob(pattern: string): boolean {
    return pattern.includes('*') || pattern.includes('?') || pattern.includes('{');
}

/**
 * Get configured spec directory patterns from settings
 */
function getConfiguredPatterns(): string[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    return config.get<string[]>('specDirectories', ['specs']);
}

/**
 * Check if a directory contains at least one .md file in its immediate children.
 */
async function directoryHasMarkdown(dirPath: string): Promise<boolean> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
        return entries.some(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'));
    } catch {
        return false;
    }
}

/**
 * Resolve all configured spec directory patterns into spec folder entries.
 * - Simple names (no globs): list children of that directory, each child is a spec folder
 * - Glob patterns: each match IS a spec folder directly
 */
export async function resolveSpecDirectories(workspaceRoot: string): Promise<SpecDirectoryInfo[]> {
    const patterns = getConfiguredPatterns();
    const specs: SpecDirectoryInfo[] = [];
    const seenPaths = new Set<string>();

    for (const pattern of patterns) {
        if (hasGlob(pattern)) {
            // Glob pattern: each match is a spec folder
            const matches = await expandGlobPattern(workspaceRoot, pattern);
            for (const match of matches) {
                if (!seenPaths.has(match.path)) {
                    seenPaths.add(match.path);
                    specs.push(match);
                }
            }
        } else {
            // Simple directory: list children as spec folders
            const dirPath = path.join(workspaceRoot, pattern);
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory) {
                        const specPath = `${pattern}/${name}`;
                        if (!seenPaths.has(specPath)) {
                            const hasContent = await directoryHasMarkdown(path.join(dirPath, name));
                            if (hasContent) {
                                seenPaths.add(specPath);
                                specs.push({ name, path: specPath });
                            }
                        }
                    }
                }
            } catch {
                // Directory doesn't exist, skip
            }
        }
    }

    // Add parent path disambiguation for duplicate names
    return addDisambiguation(specs);
}

/**
 * Expand a glob pattern to find spec directories
 */
async function expandGlobPattern(workspaceRoot: string, pattern: string): Promise<SpecDirectoryInfo[]> {
    const results: SpecDirectoryInfo[] = [];

    // Use a marker file approach: find any .md file inside matching directories
    // Then derive the directory from the match
    const filePattern = new vscode.RelativePattern(workspaceRoot, `${pattern}/*.md`);
    const files = await vscode.workspace.findFiles(filePattern, '**/node_modules/**');

    const seenDirs = new Set<string>();
    for (const file of files) {
        const dir = path.dirname(file.fsPath);
        if (seenDirs.has(dir)) {
            continue;
        }
        seenDirs.add(dir);

        const relativePath = path.relative(workspaceRoot, dir).replace(/\\/g, '/');
        const name = path.basename(dir);
        results.push({ name, path: relativePath });
    }

    // Also check for directories that match the pattern directly (may have no .md files at root)
    // Look for .md files in subdirectories (e.g., openspec/changes/*/specs/*/spec.md)
    const deepFilePattern = new vscode.RelativePattern(workspaceRoot, `${pattern}/**/*.md`);
    const deepFiles = await vscode.workspace.findFiles(deepFilePattern, '**/node_modules/**');
    for (const file of deepFiles) {
        // Walk up to find the directory that matches the pattern depth
        const patternDepth = pattern.split('/').length;
        const fileRelative = path.relative(workspaceRoot, file.fsPath).replace(/\\/g, '/');
        const fileParts = fileRelative.split('/');
        if (fileParts.length > patternDepth) {
            const dirParts = fileParts.slice(0, patternDepth);
            const dirAbsolute = path.join(workspaceRoot, ...dirParts);
            if (!seenDirs.has(dirAbsolute)) {
                // Only include if the directory itself has .md files (not just nested subdirs)
                const hasContent = await directoryHasMarkdown(dirAbsolute);
                if (hasContent) {
                    seenDirs.add(dirAbsolute);
                    const relativePath = dirParts.join('/');
                    results.push({ name: dirParts[dirParts.length - 1], path: relativePath });
                }
            }
        }
    }

    // Also look for spec.md directly (legacy support)
    const specFilePattern = new vscode.RelativePattern(workspaceRoot, `${pattern}/spec.md`);
    const specFiles = await vscode.workspace.findFiles(specFilePattern, '**/node_modules/**');
    for (const file of specFiles) {
        const dir = path.dirname(file.fsPath);
        if (seenDirs.has(dir)) {
            continue;
        }
        seenDirs.add(dir);

        const relativePath = path.relative(workspaceRoot, dir).replace(/\\/g, '/');
        const name = path.basename(dir);
        results.push({ name, path: relativePath });
    }

    // Final fallback: check if the pattern matches actual directories on disk
    // by using the parent of the pattern and scanning
    if (results.length === 0) {
        const parentPattern = pattern.substring(0, pattern.lastIndexOf('/'));
        if (parentPattern && hasGlob(parentPattern)) {
            // Find any file in parent dirs to discover them
            const parentFilePattern = new vscode.RelativePattern(workspaceRoot, `${parentPattern}/*`);
            const parentFiles = await vscode.workspace.findFiles(parentFilePattern, '**/node_modules/**');
            for (const file of parentFiles) {
                const parentDir = path.dirname(file.fsPath);
                // Now check children matching the last segment
                const lastSegment = pattern.substring(pattern.lastIndexOf('/') + 1);
                if (!hasGlob(lastSegment)) {
                    const candidateDir = path.join(parentDir, lastSegment);
                    try {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(candidateDir));
                        if (stat.type === vscode.FileType.Directory && !seenDirs.has(candidateDir)) {
                            seenDirs.add(candidateDir);
                            const relativePath = path.relative(workspaceRoot, candidateDir).replace(/\\/g, '/');
                            results.push({ name: path.basename(candidateDir), path: relativePath });
                        }
                    } catch {
                        // doesn't exist
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Add parent path to description for specs with duplicate names
 */
function addDisambiguation(specs: SpecDirectoryInfo[]): SpecDirectoryInfo[] {
    // Count occurrences of each name
    const nameCounts = new Map<string, number>();
    for (const spec of specs) {
        nameCounts.set(spec.name, (nameCounts.get(spec.name) || 0) + 1);
    }
    // No mutation needed — disambiguation is handled at display time via description
    // Just mark which ones need it by returning as-is; the provider checks for dupes
    return specs;
}

/**
 * Derive the change root from a spec directory path.
 * For a pattern like "openspec/changes/STAR/specs/STAR" and spec dir
 * "openspec/changes/nav-bar/specs/navigation/", the change root is
 * "openspec/changes/nav-bar/" (everything before the "/specs/" boundary).
 *
 * Returns absolute path or null if no change root (traditional flat layout).
 */
export function deriveChangeRoot(specDirAbsolute: string, workspaceRoot: string): string | null {
    const patterns = getConfiguredPatterns();
    const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
    const normalizedDir = specDirAbsolute.replace(/\\/g, '/');

    let relativePath: string;
    if (normalizedDir.startsWith(normalizedRoot)) {
        relativePath = normalizedDir.substring(normalizedRoot.length + 1);
    } else {
        relativePath = normalizedDir;
    }

    for (const pattern of patterns) {
        if (!hasGlob(pattern)) continue;

        // Check if this pattern matches the spec dir
        const matched = matchGlobAsPrefix(relativePath, pattern);
        if (!matched) continue;

        // Find the `/specs/` literal segment in the pattern
        const patternParts = pattern.split('/');
        const specsIndex = patternParts.indexOf('specs');
        if (specsIndex <= 0) continue;

        // The change root is the matched path segments up to the specs boundary
        const pathParts = relativePath.split('/');
        const changeRootRelative = pathParts.slice(0, specsIndex).join('/');
        return path.join(workspaceRoot, changeRootRelative);
    }

    return null;
}

/**
 * Try to match a relative directory path against a glob spec pattern (as prefix).
 * Unlike matchGlobSpecDir which requires the path to be deeper than the pattern,
 * this checks if the path matches exactly the pattern depth.
 */
function matchGlobAsPrefix(relativePath: string, pattern: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = relativePath.split('/');

    if (pathParts.length < patternParts.length) {
        return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        if (patternPart === '*' || patternPart === '**') {
            continue;
        } else if (patternPart.includes('*') || patternPart.includes('?')) {
            const regex = new RegExp('^' + patternPart.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            if (!regex.test(pathParts[i])) {
                return false;
            }
        } else {
            if (pathParts[i] !== patternPart) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Check if a file path is inside any configured spec directory.
 * Returns the spec folder relative path if found, undefined otherwise.
 */
export function isInsideSpecDirectory(filePath: string, workspaceRoot: string): string | undefined {
    const patterns = getConfiguredPatterns();
    const normalizedFile = filePath.replace(/\\/g, '/');
    const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

    // Get relative path from workspace root
    let relativePath: string;
    if (normalizedFile.startsWith(normalizedRoot)) {
        relativePath = normalizedFile.substring(normalizedRoot.length + 1);
    } else {
        relativePath = normalizedFile;
    }

    for (const pattern of patterns) {
        if (hasGlob(pattern)) {
            // For glob patterns, try to match the directory structure
            const result = matchGlobSpecDir(relativePath, pattern);
            if (result) {
                return result;
            }
        } else {
            // Simple pattern: check if file is under pattern/specName/
            const prefix = pattern + '/';
            if (relativePath.startsWith(prefix)) {
                const rest = relativePath.substring(prefix.length);
                const specName = rest.split('/')[0];
                if (specName) {
                    return `${pattern}/${specName}`;
                }
            }
        }
    }

    return undefined;
}

/**
 * Try to match a relative file path against a glob spec pattern.
 * Returns the spec directory relative path if matched.
 */
function matchGlobSpecDir(relativePath: string, pattern: string): string | undefined {
    // Convert glob pattern to regex segments
    const patternParts = pattern.split('/');
    const pathParts = relativePath.split('/');

    if (pathParts.length <= patternParts.length) {
        // File must be deeper than the pattern (inside the spec dir)
        return undefined;
    }

    // Try to match each pattern segment against path segments
    let pathIdx = 0;
    for (let i = 0; i < patternParts.length; i++) {
        if (pathIdx >= pathParts.length) {
            return undefined;
        }
        const patternPart = patternParts[i];
        if (patternPart === '*' || patternPart === '**') {
            // Wildcard matches any single segment
            pathIdx++;
        } else if (patternPart.includes('*') || patternPart.includes('?')) {
            // Partial glob — convert to regex
            const regex = new RegExp('^' + patternPart.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
            if (!regex.test(pathParts[pathIdx])) {
                return undefined;
            }
            pathIdx++;
        } else {
            if (pathParts[pathIdx] !== patternPart) {
                return undefined;
            }
            pathIdx++;
        }
    }

    // The matched portion is the spec directory
    return pathParts.slice(0, patternParts.length).join('/');
}

/**
 * Get file watcher glob patterns for all configured spec directories.
 * Returns patterns suitable for vscode.workspace.createFileSystemWatcher
 */
export function getFileWatcherPatterns(): { specs: string[]; tasks: string[]; markdown: string[] } {
    const patterns = getConfiguredPatterns();
    const specs: string[] = [];
    const tasks: string[] = [];
    const markdown: string[] = [];

    for (const pattern of patterns) {
        if (hasGlob(pattern)) {
            specs.push(`**/${pattern}/**/*`);
            tasks.push(`**/${pattern}/**/tasks.md`);
            markdown.push(`**/${pattern}/**/*.md`);
        } else {
            specs.push(`**/${pattern}/**/*`);
            tasks.push(`**/${pattern}/**/tasks.md`);
            markdown.push(`**/${pattern}/**/*.md`);
        }
    }

    return { specs, tasks, markdown };
}

/**
 * Check if a set of specs has duplicate names (for disambiguation in tree view)
 */
export function hasDuplicateNames(specs: SpecDirectoryInfo[]): Set<string> {
    const nameCounts = new Map<string, number>();
    for (const spec of specs) {
        nameCounts.set(spec.name, (nameCounts.get(spec.name) || 0) + 1);
    }
    const duplicates = new Set<string>();
    for (const [name, count] of nameCounts) {
        if (count > 1) {
            duplicates.add(name);
        }
    }
    return duplicates;
}

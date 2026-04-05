/**
 * SpecKit Companion - Document Scanner
 * Scans spec directories for available documents
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    SpecDocument,
    CoreDocumentType,
    CORE_DOCUMENT_FILES,
    CORE_DOCUMENT_LABELS
} from './types';
import { fileNameToDocType, fileNameToDisplayName } from './utils';
import type { WorkflowStepConfig } from '../workflows/types';

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert nested file path to display name
 * e.g., "contracts/webview-messages.md" -> "Contracts: Webview Messages"
 */
function nestedFileToDisplayName(relativePath: string): string {
    const parts = relativePath.replace(/\.md$/i, '').split('/');
    return parts
        .map(part => part.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()))
        .join(': ');
}

/**
 * Convert nested file path to document type
 * e.g., "contracts/webview-messages.md" -> "contracts/webview-messages"
 */
function nestedFileToDocType(relativePath: string): string {
    return relativePath.replace(/\.md$/i, '').toLowerCase();
}

/**
 * Recursively scan a directory for .md files
 */
async function scanDirectoryRecursive(
    dirPath: string,
    basePath: string,
    outputChannel: vscode.OutputChannel
): Promise<{ relativePath: string; fullPath: string }[]> {
    const results: { relativePath: string; fullPath: string }[] = [];

    try {
        const uri = vscode.Uri.file(dirPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [name, fileType] of entries) {
            const fullPath = path.join(dirPath, name);
            const relativePath = path.relative(basePath, fullPath);

            // Skip hidden directories
            if (name.startsWith('.')) {
                continue;
            }

            if (fileType === vscode.FileType.Directory) {
                // Recurse into subdirectory
                const subResults = await scanDirectoryRecursive(fullPath, basePath, outputChannel);
                results.push(...subResults);
            } else if (fileType === vscode.FileType.File && name.endsWith('.md')) {
                results.push({ relativePath, fullPath });
            }
        }
    } catch (error) {
        outputChannel.appendLine(`[SpecViewer] Error scanning subdirectory ${dirPath}: ${error}`);
    }

    return results;
}

/**
 * Scan spec directory for available documents.
 * When `steps` is provided, uses workflow step files as core documents
 * instead of the hard-coded CORE_DOCUMENT_FILES.
 * When `changeRoot` is provided, also checks the change root for step files
 * (e.g. design.md, tasks.md at the change root level).
 */
export async function scanDocuments(
    specDirectory: string,
    outputChannel: vscode.OutputChannel,
    steps?: WorkflowStepConfig[],
    changeRoot?: string | null
): Promise<SpecDocument[]> {
    const documents: SpecDocument[] = [];

    // Build core documents from workflow steps or fall back to defaults
    const coreFiles = new Set<string>();

    if (steps && steps.length > 0) {
        for (const step of steps) {
            // Skip action-only steps (e.g. implement/apply) — they have no output file
            if (step.actionOnly) continue;

            const fileName = step.file ?? `${step.name}.md`;

            // Try specDirectory first, then changeRoot
            let filePath = path.join(specDirectory, fileName);
            let exists = await fileExists(filePath);

            if (!exists && changeRoot && changeRoot !== specDirectory) {
                const changeRootPath = path.join(changeRoot, fileName);
                const existsAtRoot = await fileExists(changeRootPath);
                if (existsAtRoot) {
                    filePath = changeRootPath;
                    exists = true;
                }
            }

            const labelOverrides: Record<string, string> = { specify: 'Specification' };
            const label = step.label || labelOverrides[step.name] || step.name.charAt(0).toUpperCase() + step.name.slice(1);

            coreFiles.add(fileName);
            documents.push({
                type: step.name,
                label,
                fileName,
                filePath,
                exists,
                isCore: true,
                category: 'core'
            });

            // Scan subDir for sub-specs belonging to this step
            if (step.subDir) {
                const stepFile = step.file ?? `${step.name}.md`;
                const subDirPath = path.join(specDirectory, step.subDir);
                try {
                    const subDirUri = vscode.Uri.file(subDirPath);
                    const subEntries = await vscode.workspace.fs.readDirectory(subDirUri);
                    for (const [name, fileType] of subEntries) {
                        if (fileType === vscode.FileType.Directory) {
                            const subSpecFile = path.join(subDirPath, name, stepFile);
                            const subExists = await fileExists(subSpecFile);
                            if (subExists) {
                                const subName = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                const docType = `${step.subDir}/${name}`;
                                documents.push({
                                    type: docType,
                                    label: subName,
                                    fileName: `${step.subDir}/${name}/${stepFile}`,
                                    filePath: subSpecFile,
                                    exists: true,
                                    isCore: false,
                                    category: 'related',
                                    parentStep: step.name
                                });
                            }
                        } else if (fileType === vscode.FileType.File && name.endsWith('.md')) {
                            // Flat .md files in subDir
                            const flatFilePath = path.join(subDirPath, name);
                            const flatDocType = `${step.subDir}/${name.replace(/\.md$/i, '')}`;
                            const flatLabel = name.replace(/\.md$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            documents.push({
                                type: flatDocType,
                                label: flatLabel,
                                fileName: `${step.subDir}/${name}`,
                                filePath: flatFilePath,
                                exists: true,
                                isCore: false,
                                category: 'related',
                                parentStep: step.name
                            });
                        }
                    }
                } catch {
                    // subDir doesn't exist
                }
            }
        }
    } else {
        // Default: hard-coded core documents
        for (const [type, fileName] of Object.entries(CORE_DOCUMENT_FILES)) {
            let filePath = path.join(specDirectory, fileName);
            let exists = await fileExists(filePath);

            if (!exists && changeRoot && changeRoot !== specDirectory) {
                const changeRootPath = path.join(changeRoot, fileName);
                const existsAtRoot = await fileExists(changeRootPath);
                if (existsAtRoot) {
                    filePath = changeRootPath;
                    exists = true;
                }
            }

            coreFiles.add(fileName);
            documents.push({
                type: type as CoreDocumentType,
                label: CORE_DOCUMENT_LABELS[type as CoreDocumentType],
                fileName,
                filePath,
                exists,
                isCore: true,
                category: 'core'
            });
        }
    }

    // Collect file paths already discovered by subDir scans to avoid duplicates
    const subDirFiles = new Set(
        documents.filter(d => d.parentStep).map(d => d.filePath)
    );

    // Scan for related documents (including subdirectories)
    // Scan both specDirectory and changeRoot
    const seenRelativePaths = new Set<string>();

    const scanRelatedDocs = async (dir: string) => {
        try {
            const allFiles = await scanDirectoryRecursive(dir, dir, outputChannel);

            for (const { relativePath, fullPath } of allFiles) {
                const fileName = path.basename(relativePath);

                // Skip files already discovered by subDir scans
                if (subDirFiles.has(fullPath)) continue;

                // Skip core documents (already added)
                if (coreFiles.has(fileName) && !relativePath.includes('/')) {
                    continue;
                }

                // Skip duplicates across dirs
                if (seenRelativePaths.has(relativePath)) continue;
                seenRelativePaths.add(relativePath);

                // Determine if this is a nested file (contains path separator)
                const isNested = relativePath.includes('/') || relativePath.includes(path.sep);

                documents.push({
                    type: isNested ? nestedFileToDocType(relativePath) : fileNameToDocType(fileName),
                    label: isNested ? nestedFileToDisplayName(relativePath) : fileNameToDisplayName(fileName),
                    fileName: relativePath,
                    filePath: fullPath,
                    exists: true,
                    isCore: false,
                    category: 'related'
                });
            }
        } catch (error) {
            outputChannel.appendLine(`[SpecViewer] Error scanning directory ${dir}: ${error}`);
        }
    };

    await scanRelatedDocs(specDirectory);
    if (changeRoot && changeRoot !== specDirectory) {
        await scanRelatedDocs(changeRoot);
    }

    // Assign parentStep to orphan related docs (no parentStep yet)
    if (steps && steps.length > 0) {
        const includeRelatedStep = steps.find(s => !s.actionOnly && s.includeRelatedDocs);
        const contentSteps = steps.filter(s => !s.actionOnly);
        const fallbackStep = contentSteps.length >= 2 ? contentSteps[1] : contentSteps[contentSteps.length - 1];

        for (const doc of documents) {
            if (doc.isCore || doc.parentStep) continue;

            // 1. Match against each step's subFiles list
            const matchingStep = steps.find(s =>
                !s.actionOnly && s.subFiles?.some(f => doc.fileName === f || doc.fileName.endsWith(`/${f}`))
            );
            if (matchingStep) {
                doc.parentStep = matchingStep.name;
                continue;
            }

            // 2. Assign to the step with includeRelatedDocs: true
            if (includeRelatedStep) {
                doc.parentStep = includeRelatedStep.name;
                continue;
            }

            // 3. Fall back to second content step (plan-like) or last if only one
            if (fallbackStep) {
                doc.parentStep = fallbackStep.name;
            }
        }
    }

    // Sort: core documents first (in step declaration order), then related docs alphabetically
    const coreOrder = documents.filter(d => d.isCore).map(d => d.type);
    documents.sort((a, b) => {
        if (a.isCore && !b.isCore) return -1;
        if (!a.isCore && b.isCore) return 1;
        if (a.isCore && b.isCore) {
            return coreOrder.indexOf(a.type) - coreOrder.indexOf(b.type);
        }
        return a.label.localeCompare(b.label);
    });

    return documents;
}

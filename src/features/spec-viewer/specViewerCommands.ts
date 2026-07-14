import * as vscode from 'vscode';
import { SpecViewerProvider } from './specViewerProvider';

/**
 * Register spec viewer commands and return the provider instance
 */
export function registerSpecViewerCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): SpecViewerProvider {
    // Create provider instance
    const provider = new SpecViewerProvider(context, outputChannel);

    // Register command to view spec documents
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'speckit.viewSpecDocument',
            (filePath: string, opts?: { living?: boolean }) => {
                provider.show(filePath, opts);
            },
        )
    );

    // Spec-level open: the viewer decides which document backs the panel and whether to land on the Overview.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'speckit.openSpec',
            (specDirectory: string) => {
                provider.showSpec(specDirectory);
            },
        )
    );

    outputChannel.appendLine('[SpecViewer] Commands registered');

    return provider;
}

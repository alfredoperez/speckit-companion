import * as vscode from 'vscode';
import {
    AIProviderType,
    PROVIDER_PATHS,
    getConfiguredProviderType,
    readPermissionMode,
} from './aiProvider';

const SUPPRESSED_KEY = 'speckit.permissionValidation.suppressed';

export function getPermissionFlagForProvider(type: AIProviderType): string {
    const flag = PROVIDER_PATHS[type]?.autoApproveFlag ?? '';
    if (!flag) return '';
    return readPermissionMode() === 'auto-approve' ? flag : '';
}

export async function validatePermissionMode(context: vscode.ExtensionContext): Promise<void> {
    const providerType = getConfiguredProviderType();
    const paths = PROVIDER_PATHS[providerType];
    if (!paths) return;

    const mode = readPermissionMode();
    const needsWarning =
        mode === 'interactive' &&
        paths.supportsInteractivePermissions === false &&
        paths.autoApproveFlag.length > 0;

    if (!needsWarning) return;

    const comboKey = `${providerType}-${mode}`;
    const suppressed = context.globalState.get<string>(SUPPRESSED_KEY);
    if (suppressed === comboKey) return;

    const action = await vscode.window.showWarningMessage(
        `${paths.displayName} does not support interactive permission prompts. Switch to Auto-Approve?`,
        'Switch to Auto-Approve',
        'Keep Interactive'
    );

    if (action === 'Switch to Auto-Approve') {
        await vscode.workspace
            .getConfiguration('speckit')
            .update('permissionMode', 'auto-approve', vscode.ConfigurationTarget.Global);
        await context.globalState.update(SUPPRESSED_KEY, undefined);
    } else {
        await context.globalState.update(SUPPRESSED_KEY, comboKey);
    }
}

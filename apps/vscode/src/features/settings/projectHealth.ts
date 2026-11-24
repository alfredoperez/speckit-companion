import * as fs from 'fs';
import * as path from 'path';
import { specifyVersion, installedAgents } from '../../speckit/specKitUpgrade';
import { SpecKitDetector } from '../../speckit/detector';
import { isCompanionInstalled } from './companionPresetReconciler';

export type HealthId = 'cli' | 'companion' | 'constitution' | 'agent';

export interface HealthCheck {
    id: HealthId;
    ok: boolean;
    label: string;
    detail: string;
    /** The existing VS Code command that fixes it. */
    fixCommand: string;
    fixTitle: string;
}

export type ConstitutionState = 'missing' | 'template' | 'filled';

export function constitutionState(root: string): ConstitutionState {
    let content: string;
    try {
        content = fs.readFileSync(path.join(root, '.specify', 'memory', 'constitution.md'), 'utf-8');
    } catch {
        return 'missing';
    }
    // The Sync Impact Report is an HTML comment naming every placeholder it replaced.
    const body = content.replace(/<!--[\s\S]*?-->/g, '');
    return /\[PROJECT_NAME\]|\[PRINCIPLE_\d+_NAME\]|\[PLACEHOLDER\]/.test(body) ? 'template' : 'filled';
}

export async function gatherProjectHealth(root: string): Promise<HealthCheck[]> {
    const installed = await SpecKitDetector.getInstance().checkCliInstalled();
    const version = installed ? await specifyVersion() : undefined;
    const constitution = constitutionState(root);
    const agents = installedAgents(root);
    const companion = isCompanionInstalled(root);
    return [
        {
            id: 'cli', ok: installed, label: 'Spec Kit CLI',
            detail: !installed ? 'Not installed' : version?.cli ? `v${version.cli}` : 'Installed, version unknown',
            fixCommand: 'speckit.installCli', fixTitle: 'Install the Spec Kit CLI',
        },
        {
            id: 'companion', ok: companion, label: 'Companion',
            detail: companion ? 'Installed' : 'Not installed',
            fixCommand: 'speckit.companion.installSpecKitExtension', fixTitle: 'Install the Companion extension',
        },
        {
            id: 'constitution', ok: constitution === 'filled', label: 'Constitution',
            detail: constitution === 'filled' ? 'Filled in' : constitution === 'template' ? 'Still the template' : 'Missing',
            fixCommand: 'speckit.constitution', fixTitle: 'Write the constitution',
        },
        {
            id: 'agent', ok: agents.length > 0, label: 'AI agent',
            detail: agents.length > 0 ? agents.join(', ') : 'None set up',
            fixCommand: 'speckit.initWorkspace', fixTitle: 'Initialize the project and pick an agent',
        },
    ];
}

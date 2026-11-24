// The workflow name in the header, and the list of workflows it switches between.
import { PipelineBuildKind } from '../../../src/protocol/pipeline';
import { Menu, MenuOption } from './Menu';

/** Starts a workflow rather than switching to one. A workflow is a `.yml` stem, so `#` cannot be one. */
export const NEW_WORKFLOW = '#new';

export function workflowLabel(name: string): string {
    if (name === '') { return 'This project'; }
    if (name === 'shipped') { return 'Shipped'; }
    return name;
}

interface Props {
    available: string[];
    active: string;
    buildState: PipelineBuildKind;
    onSelect: (name: string) => void;
    onNew: () => void;
    defaultOpen?: boolean;
}

export function workflowOptions(available: string[], active: string, buildState: PipelineBuildKind): MenuOption[] {
    const row = (name: string): MenuOption => ({
        id: name,
        label: workflowLabel(name),
        note: name === 'shipped' ? 'Nothing changed'
            : name === '' ? 'Whatever .specify/companion.yml says' : undefined,
        checked: name === active,
        trail: name === active && buildState === 'current' ? 'built' : undefined,
        mono: name !== '' && name !== 'shipped',
        group: name !== '' && name !== 'shipped' ? 'Saved' : undefined,
    });
    const fixed = ['shipped', ''].filter(name => available.includes(name));
    const saved = available.filter(name => name !== '' && name !== 'shipped');
    return [
        ...fixed.map(row),
        ...saved.map(row),
        { id: NEW_WORKFLOW, label: 'New workflow…', note: 'Starts from Shipped, This project or a preset', more: true, rule: true },
    ];
}

export function WorkflowMenu({ available, active, buildState, onSelect, onNew, defaultOpen }: Props) {
    return (
        <Menu
            class="builder-workflow-current"
            trigger={workflowLabel(active)}
            label={`Workflow: ${workflowLabel(active)}`}
            title="The way of working this project is on"
            options={workflowOptions(available, active, buildState)}
            defaultOpen={defaultOpen}
            onPick={id => (id === NEW_WORKFLOW ? onNew() : onSelect(id))} />
    );
}

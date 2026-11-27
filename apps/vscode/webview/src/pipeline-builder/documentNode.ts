// Which node a step's templated document is edited from: the one that writes it.
import { PipelineNode, PipelineStep } from '../../../src/protocol/pipeline';

/** `plan-template.md` is the shape of `plan.md`. */
export function documentFile(template: string): string {
    return template.replace(/-template(\.md)$/, '$1');
}

/** Whether the step has a template with any section to show. */
export function hasDocument(step: PipelineStep): boolean {
    const t = step.template;
    return Boolean(t && (t.sectionsAvailable.length > 0 || t.sections.length > 0));
}

/** The node that writes the file, else the first authoring node, so the template stays reachable. */
export function documentNodeId(step: PipelineStep): string | null {
    if (!hasDocument(step)) { return null; }
    const file = documentFile(step.template!.file);
    const nodes: PipelineNode[] = step.phases.flatMap(p => p.nodes);
    const named = (n: PipelineNode) => [...n.writes, ...n.mayWrite]
        .some(w => w === file || w.endsWith(`/${file}`));
    return (nodes.find(named) ?? nodes.find(n => n.kind === 'author') ?? nodes[0])?.id ?? null;
}

/** Every section the document has, the replaced ones included. */
export function sectionsOf(step: PipelineStep): string[] {
    const t = step.template;
    if (!t) { return []; }
    return [...t.sectionsAvailable, ...t.sections.filter(s => !t.sectionsAvailable.includes(s))];
}

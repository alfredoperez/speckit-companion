// The Spec Kit presets installed here, and how to add one (not the Companion's workflow presets).
import { useState } from 'preact/hooks';
import { PRESET_ID_PATTERN, PRESET_QUERY_PATTERN } from '../../../src/protocol/pipeline';
import type { SpecPreset } from '../../../src/protocol/pipeline';

export interface PresetsPanelProps {
    presets: SpecPreset[];
    onSearch: (query: string) => void;
    onAdd: (id: string) => void;
    onUpdate: (id: string) => void;
    onRemove: (id: string) => void;
}

function PresetRow({ preset, onUpdate, onRemove }: {
    preset: SpecPreset; onUpdate: (id: string) => void; onRemove: (id: string) => void;
}) {
    return (
        <li class="pb-spec-preset">
            <div class="pb-spec-preset-head">
                <span class="pb-stock-preset-name">{preset.name || preset.id}</span>
                <span class="pb-stock-preset-note">
                    {[preset.version, preset.source, preset.enabled ? 'on' : 'off',
                        `priority ${preset.priority}`].filter(Boolean).join(' · ')}
                </span>
            </div>
            {preset.problem && (
                <p class="pb-field-problem pb-spec-preset-problem">{preset.problem}</p>
            )}
            {preset.items.length > 0 && (
                <ul class="pb-spec-preset-items">
                    {preset.items.map((item, i) => (
                        <li class="pb-spec-preset-item" key={`${item.type}/${item.name}/${i}`}>
                            {`${item.type} ${item.name} → replaces ${item.replaces} (${item.strategy})`}
                        </li>
                    ))}
                </ul>
            )}
            {preset.clashes.length > 0 && (
                <p class="pb-field-problem pb-spec-preset-clash">
                    {`Overlaps ${preset.clashes.join(', ')}: Companion's hooks or templates may be bypassed.`}
                </p>
            )}
            <div class="pb-spec-preset-actions">
                <button class="builder-action builder-action--quiet" type="button"
                    onClick={() => onUpdate(preset.id)}>Update</button>
                <button class="builder-action builder-action--quiet" type="button"
                    onClick={() => onRemove(preset.id)}>Remove</button>
            </div>
        </li>
    );
}

export function PresetsPanel({ presets, onSearch, onAdd, onUpdate, onRemove }: PresetsPanelProps) {
    const [query, setQuery] = useState('');
    const [id, setId] = useState('');
    const q = query.trim();
    const wanted = id.trim();
    const queryOk = PRESET_QUERY_PATTERN.test(q);
    const idOk = PRESET_ID_PATTERN.test(wanted);

    return (
        <div class="pb-spec-presets">
            <form class="pb-spec-preset-find" onSubmit={e => { e.preventDefault(); if (queryOk) { onSearch(q); } }}>
                <input class="pb-input" type="text" value={query} placeholder="Search presets"
                    aria-label="Search Spec Kit presets"
                    onInput={e => setQuery((e.target as HTMLInputElement).value)} />
                <button class="builder-action" type="submit" disabled={!queryOk}>Search</button>
            </form>
            <form class="pb-spec-preset-find" onSubmit={e => { e.preventDefault(); if (idOk) { onAdd(wanted); } }}>
                <input class="pb-input pb-input--mono" type="text" value={id}
                    placeholder="Add by id" aria-label="Add a Spec Kit preset by id"
                    onInput={e => setId((e.target as HTMLInputElement).value)} />
                <button class="builder-action" type="submit" disabled={!idOk}>Add</button>
            </form>
            {presets.length === 0 ? (
                <p class="pb-stock-prose">No Spec Kit presets installed here.</p>
            ) : (
                <ul class="pb-stock-presets">
                    {presets.map(p => (
                        <PresetRow key={p.id} preset={p} onUpdate={onUpdate} onRemove={onRemove} />
                    ))}
                </ul>
            )}
        </div>
    );
}

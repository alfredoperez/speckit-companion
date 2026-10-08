# Data Model

- **FenceInfo**: `{ language: string; title: string; options: Map<string, string | true> }`. `language` is empty unless it passes the strict name check. Nothing else is ever written to an attribute.
- **BlockFence name**: `'calls' | 'states' | 'screen'`. Renderers: `Partial<Record<name, (body, info) => string>>`, empty in this step.
- **openFile message**: `{ type: 'openFile'; filename: string; line?: number }`. `line` is a positive integer.

# Research: Update Architecture & Documentation

## Decision Log

### D1: Scope of architecture.md rewrite
- **Decision**: Full rewrite of directory structure and key components sections
- **Rationale**: The current content describes a completely different architecture (pre-refactor). Every directory listed at src/ top-level is wrong except `extension.ts` and `features/`. Patching would be more error-prone than rewriting.
- **Alternatives**: Incremental patches — rejected because the delta is too large

### D2: Scope of how-it-works.md updates
- **Decision**: Targeted updates to provider list, tree views, project structure, capabilities matrix, mermaid diagrams, and config keys
- **Rationale**: The overall document structure (sections, data flow examples, extension points) is still valid. Only factual claims about components/providers/views need correction.
- **Alternatives**: Full rewrite — rejected, most narrative content is still accurate

### D3: CLAUDE.md changes
- **Decision**: No changes needed
- **Rationale**: CLAUDE.md was recently updated (044-context-driven-badges) and already accurately reflects the current structure with core/, features/, ai-providers/, speckit/, and the full webview layout.
- **Alternatives**: N/A

### D4: Tree view count (3 vs 7)
- **Decision**: Document 3 registered tree views (explorer, steering, settings)
- **Rationale**: package.json only registers 3 view IDs. Agents, skills, hooks, and MCP are not separate tree views — they may be commands or integrated into the settings/overview provider.
- **Alternatives**: None — this is a factual correction

### D5: AI provider capabilities for Codex and Qwen
- **Decision**: Add Codex and Qwen to the capabilities matrix with accurate flags based on their provider implementations
- **Rationale**: Both providers exist in src/ai-providers/ with full implementations (codexCliProvider.ts, qwenCliProvider.ts). The capabilities matrix must reflect all 5 providers.
- **Alternatives**: None — factual correction

### D6: Configuration keys documentation
- **Decision**: Update config keys section to include all settings from package.json
- **Rationale**: Several settings added in recent features are missing from docs: speckit.specDirectories, speckit.customWorkflows, speckit.defaultWorkflow, speckit.customCommands, speckit.qwenPath, speckit.permissionMode
- **Alternatives**: None — factual correction

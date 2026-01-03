/**
 * All command IDs used in the extension
 */
export const Commands = {
    create: 'speckit.create',
    specify: 'speckit.specify',
    plan: 'speckit.plan',
    tasks: 'speckit.tasks',
    implement: 'speckit.implement',
    clarify: 'speckit.clarify',
    analyze: 'speckit.analyze',
    checklist: 'speckit.checklist',
    constitution: 'speckit.constitution',
    refresh: 'speckit.refresh',
    delete: 'speckit.delete',
    installCli: 'speckit.installCli',
    initWorkspace: 'speckit.initWorkspace',
    upgradeCli: 'speckit.upgradeCli',
    upgradeProject: 'speckit.upgradeProject',
    upgradeAll: 'speckit.upgradeAll',
    checkForUpdates: 'speckit.checkForUpdates',
    steering: {
        create: 'speckit.steering.create',
        createUserRule: 'speckit.steering.createUserRule',
        createProjectRule: 'speckit.steering.createProjectRule',
        refine: 'speckit.steering.refine',
        delete: 'speckit.steering.delete',
        refresh: 'speckit.steering.refresh',
    },
    workflowEditor: {
        editSource: 'speckit.workflowEditor.editSource',
        refineSection: 'speckit.workflowEditor.refineSection',
        removeSection: 'speckit.workflowEditor.removeSection',
        addUserStory: 'speckit.workflowEditor.addUserStory',
        approveAndContinue: 'speckit.workflowEditor.approveAndContinue',
        regenerate: 'speckit.workflowEditor.regenerate',
        navigateToPhase: 'speckit.workflowEditor.navigateToPhase',
        refineLine: 'speckit.workflowEditor.refineLine',
    },
    agents: { refresh: 'speckit.agents.refresh' },
    skills: { refresh: 'speckit.skills.refresh', openSkill: 'speckit.skills.openSkill' },
    hooks: { refresh: 'speckit.hooks.refresh' },
    mcp: { refresh: 'speckit.mcp.refresh' },
    settings: { open: 'speckit.settings.open' },
} as const;

/**
 * Configuration keys for VS Code settings
 */
export const ConfigKeys = {
    namespace: 'speckit',
    workflowEditorEnabled: 'speckit.workflowEditor.enabled',
    claudePath: 'speckit.claudePath',
    aiProvider: 'speckit.aiProvider',
    geminiInitDelay: 'speckit.geminiInitDelay',
    views: {
        specsVisible: 'speckit.views.specs.visible',
        agentsVisible: 'speckit.views.agents.visible',
        skillsVisible: 'speckit.views.skills.visible',
        hooksVisible: 'speckit.views.hooks.visible',
        steeringVisible: 'speckit.views.steering.visible',
        mcpVisible: 'speckit.views.mcp.visible',
        settingsVisible: 'speckit.views.settings.visible',
    },
    notifications: {
        phaseCompletion: 'speckit.notifications.phaseCompletion',
    },
} as const;

/**
 * Default paths used by the extension
 */
export const DefaultPaths = {
    specs: 'specs',
    steering: '.claude/steering',
    settings: '.claude/settings',
    claudeMd: 'CLAUDE.md',
    globalClaudeMd: '.claude/CLAUDE.md',
} as const;

/**
 * Timing constants (in milliseconds)
 */
export const Timing = {
    /** Delay before sending command to terminal (allows venv activation) */
    terminalVenvActivationDelay: 800,
    /** Delay before cleaning up temporary prompt files */
    tempFileCleanupDelay: 30000,
    /** Interval for checking shell integration availability */
    shellIntegrationCheckInterval: 100,
    /** Maximum number of shell integration checks before fallback */
    shellIntegrationMaxChecks: 20,
    /** Fallback timeout when shell integration unavailable */
    shellIntegrationFallbackTimeout: 5000,
    /** Delay before disposing terminal after execution */
    terminalDisposeDelay: 1000,
    /** Debounce delay for file watcher refresh */
    fileWatcherDebounce: 1000,
    /** Delay for Gemini CLI to initialize before sending prompt (configurable via settings) */
    geminiInitDelay: 8000,
} as const;

/**
 * Default view visibility settings
 */
export const DefaultViewVisibility = {
    specs: true,
    steering: true,
    mcp: true,
    hooks: true,
    agents: true,
    skills: true,
    settings: false,
} as const;

/**
 * Context keys for VS Code when clauses
 */
export const ContextKeys = {
    cliInstalled: 'speckit.cliInstalled',
    detected: 'speckit.detected',
    constitutionNeedsSetup: 'speckit.constitutionNeedsSetup',
} as const;

/**
 * Tree item context values for menus
 */
export const TreeItemContext = {
    spec: 'spec',
    specDocument: 'spec-document',
    specDocumentSpec: 'spec-document-spec',
    specDocumentPlan: 'spec-document-plan',
    specDocumentTasks: 'spec-document-tasks',
    specRelatedDoc: 'spec-related-doc',
    specLoading: 'spec-loading',
    steeringDocument: 'steering-document',
    steeringCategory: 'steering-category',
    agent: 'agent',
    agentBuiltIn: 'agent-builtin',
    hook: 'hook',
    mcpServer: 'mcp-server',
} as const;

/**
 * View IDs for tree data providers and custom editors
 */
export const Views = {
    explorer: 'speckit.views.explorer',
    agents: 'speckit.views.agents',
    skills: 'speckit.views.skills',
    steering: 'speckit.views.steering',
    hooks: 'speckit.views.hooks',
    mcp: 'speckit.views.mcp',
    settings: 'speckit.views.settings',
} as const;

export const EditorTypes = {
    workflowEditor: 'speckit.workflowEditor',
} as const;

/**
 * Standard file names used throughout the extension
 */
export const FileNames = {
    /** Spec requirements document */
    specFile: 'spec.md',
    /** Design/plan document */
    planFile: 'plan.md',
    /** Tasks document */
    tasksFile: 'tasks.md',
    /** Claude Code steering file */
    claudeMd: 'CLAUDE.md',
    /** Gemini CLI steering file */
    geminiMd: 'GEMINI.md',
    /** Copilot CLI steering file */
    copilotInstructions: 'copilot-instructions.md',
    /** Skill definition file */
    skillDefinition: 'SKILL.md',
    /** Claude settings file */
    settingsJson: 'settings.json',
    /** Installed plugins manifest */
    installedPluginsJson: 'installed_plugins.json',
    /** SpecKit settings file */
    speckitSettingsJson: 'speckit-settings.json',
    /** Constitution file */
    constitutionMd: 'constitution.md',
} as const;

/**
 * Standard directory names used throughout the extension
 */
export const Directories = {
    /** Claude configuration directory */
    claude: '.claude',
    /** Gemini configuration directory */
    gemini: '.gemini',
    /** SpecKit configuration directory */
    specify: '.specify',
    /** GitHub directory (for Copilot) */
    github: '.github',
    /** Specs directory */
    specs: 'specs',
    /** Agents directory */
    agents: 'agents',
    /** Skills directory */
    skills: 'skills',
    /** Steering documents directory */
    steering: 'steering',
    /** Plugins directory */
    plugins: 'plugins',
    /** System prompts directory */
    systemPrompts: 'system-prompts',
    /** Settings directory */
    settings: 'settings',
    /** Memory directory (SpecKit) */
    memory: 'memory',
    /** Scripts directory (SpecKit) */
    scripts: 'scripts',
    /** Templates directory (SpecKit) */
    templates: 'templates',
    /** Instructions directory (Copilot) */
    instructions: 'instructions',
} as const;

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
    customCommand: 'speckit.customCommand',
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
    settings: { open: 'speckit.settings.open' },
    feedback: {
        bugReport: 'speckit.feedback.bugReport',
        featureRequest: 'speckit.feedback.featureRequest',
        review: 'speckit.feedback.review',
    },
} as const;

/**
 * Configuration keys for VS Code settings
 */
export const ConfigKeys = {
    namespace: 'speckit',
    workflowEditorEnabled: 'speckit.workflowEditor.enabled',
    claudePath: 'speckit.claudePath',
    aiProvider: 'speckit.aiProvider',
    claudePermissionMode: 'speckit.claudePermissionMode',
    geminiInitDelay: 'speckit.geminiInitDelay',
    customCommands: 'speckit.customCommands',
    qwenPath: 'speckit.qwenPath',
    qwenYoloMode: 'speckit.qwenYoloMode',
    specDirectories: 'speckit.specDirectories',
    customWorkflows: 'speckit.customWorkflows',
    defaultWorkflow: 'speckit.defaultWorkflow',
    views: {
        specsVisible: 'speckit.views.specs.visible',
        steeringVisible: 'speckit.views.steering.visible',
        settingsVisible: 'speckit.views.settings.visible',
    },
    notifications: {
        phaseCompletion: 'speckit.notifications.phaseCompletion',
    },
    globalState: {
        skipVersion: 'speckit.skipVersion',
        lastUpdateCheck: 'speckit.lastUpdateCheck',
        initSuggestionDismissed: 'speckit.initSuggestionDismissed',
    },
} as const;

/**
 * Default CLI executable commands for AI providers
 */
export const CLIDefaults = {
    copilot: 'copilot',
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
    /** Timeout for waiting for shell integration to become available */
    shellReadyTimeoutMs: 5000,
    /** Delay before cleaning up temporary prompt files */
    tempFileCleanupDelay: 30000,
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
    settings: true,
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
    // Consolidated from treeContextValues.ts
    steeringLoading: 'steering-loading',
    steeringHeader: 'steering-header',
    steeringFile: 'steering-file',
    speckitHeader: 'speckit-header',
    speckitConstitution: 'speckit-constitution',
    speckitScriptsCategory: 'speckit-scripts-category',
    speckitScript: 'speckit-script',
    speckitTemplatesCategory: 'speckit-templates-category',
    speckitTemplate: 'speckit-template',
    providerHeader: 'provider-header',
    providerProjectGroup: 'provider-project-group',
    providerUserGroup: 'provider-user-group',
    providerAgentsGroup: 'provider-agents-group',
    providerSkillsGroup: 'provider-skills-group',
    providerSettings: 'provider-settings',
    skill: 'skill',
    skillWarning: 'skill-warning',
    createGlobal: 'create-global-claude',
    createProject: 'create-project-claude',
    separator: 'separator',
} as const;

/**
 * View IDs for tree data providers and custom editors
 */
export const Views = {
    explorer: 'speckit.views.explorer',
    steering: 'speckit.views.steering',
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
    /** Qwen Code steering file */
    qwenMd: 'QWEN.md',
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
 * Workflow step identifiers and their config key variants
 */
export const WorkflowSteps = {
    SPECIFY: 'specify',
    PLAN: 'plan',
    TASKS: 'tasks',
    IMPLEMENT: 'implement',
    CONFIG_SPECIFY: 'step-specify',
    CONFIG_PLAN: 'step-plan',
    CONFIG_TASKS: 'step-tasks',
    CONFIG_IMPLEMENT: 'step-implement',
} as const;

/**
 * Spec lifecycle status values
 */
export const SpecStatuses = {
    ACTIVE: 'active',
    TASKS_DONE: 'tasks-done',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
} as const;

/**
 * AI provider type identifiers
 */
export const AIProviders = {
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    COPILOT: 'copilot',
    CODEX: 'codex',
    QWEN: 'qwen',
} as const;

/**
 * Standard directory names used throughout the extension
 */
export const Directories = {
    /** Claude configuration directory */
    claude: '.claude',
    /** Gemini configuration directory */
    gemini: '.gemini',
    /** Qwen Code configuration directory */
    qwen: '.qwen',
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

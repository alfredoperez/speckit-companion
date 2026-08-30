/**
 * capture-theme.ts
 * ─────────────────────────────────────────────────────────────────────────
 * The palette every Storybook story renders in, and therefore the palette
 * every generated screenshot and every clip frame is painted in.
 *
 * WHY THIS FILE EXISTS
 * The UI is still moving, so the capture palette has to be a knob rather than
 * a hand-tuned wall of hex. A palette here is a short set of named roles
 * (grounds, hairlines, a text ramp, an accent, the four semantics). The fifty
 * odd `--vscode-*` variables VS Code hands a webview are DERIVED from those
 * roles by `deriveVscodeVars`, so a retheme is a handful of role edits, not
 * fifty coordinated ones.
 *
 * HOW TO RETHEME
 *   1. Copy a palette below, change its roles, give it a name.
 *   2. Point `activeCapturePalette` at it. That one line is the switch.
 *   3. Re-run every capture and re-render every clip (docs/visual-assets.md).
 *
 * WHAT IS NOT DERIVABLE
 * A theme carries a few colours that answer to no role: a stock current-line
 * wash, one symbol-icon hue, a casing quirk. Those stay as an explicit
 * `overrides` map on the palette, each with a line saying why.
 *
 * DETERMINISM
 * Nothing here reads the clock, the environment, or the DOM. A palette is a
 * plain object built at module load, so two capture runs see identical values.
 */

/** The named roles a palette is written in. Everything else is computed. */
export interface CaptureRoles {
    /** The editor pane: the ground most content sits on. */
    editorGround: string;
    /** The side bar pane. By convention it sits darker than the editor. */
    sidebarGround: string;
    /** Popovers, widgets, validation boxes: a surface lifted off the ground. */
    raisedSurface: string;
    /** Secondary buttons and pressed controls: one step above raised. */
    controlSurface: string;
    /** Inputs and checkboxes: the field a value is typed into. */
    inputSurface: string;
    /** The outline of a widget, and the divider inside a pane. */
    hairline: string;
    /** The outline that has to be seen: inputs, checkboxes. */
    hairlineStrong: string;
    /** The seam between two panes, and the section-header rule. */
    paneEdge: string;
    /** The focus ring. */
    focus: string;
    /** Headings and the editor's own foreground. */
    textPrimary: string;
    /** Paragraphs and the window foreground. */
    textBody: string;
    /** Placeholders and supporting copy. */
    textMuted: string;
    /** Pane titles and tree guides: the quietest legible step. */
    textDim: string;
    /** Links, selection, "this is the one you are on". */
    accent: string;
    /** The primary action's fill. Applied at alpha, the way VS Code buttons are. */
    primaryAction: string;
    /** The neutral a hover or an inactive selection is tinted from. */
    hoverWash: string;
    /** Semantic: passed, done, green. */
    pass: string;
    /** Semantic: warning, attention, yellow. */
    warn: string;
    /** Semantic: failed, blocked, red. */
    error: string;
    /** Semantic: the step in flight, cyan. */
    running: string;
}

export type VsCodeVars = Record<string, string>;

export interface CapturePalette {
    /** Which VS Code body class this palette belongs under. */
    bodyClass: 'vscode-dark' | 'vscode-light' | 'vscode-high-contrast';
    roles: CaptureRoles;
    /** Values no role can produce. Each one carries its reason. */
    overrides?: VsCodeVars;
}

/** `#rrggbb` plus a two-character alpha, the form VS Code themes are written in. */
const a = (hex: string, alpha: string): string => `${hex}${alpha}`;

/**
 * The ~fifty variables the webview reads, each computed from a role.
 *
 * The alpha steps are the theme's own: a foreground at `80` is supporting
 * copy, at `4d` it is disabled, at `cc` it is a pane's own foreground, and a
 * wash at `4d` / `40` is a hover / an inactive selection.
 */
export function deriveVscodeVars(palette: CapturePalette): VsCodeVars {
    const r = palette.roles;
    return {
        // ── grounds and panes ──────────────────────────────────────────
        '--vscode-editor-background': r.editorGround,
        '--vscode-editor-foreground': r.textPrimary,
        '--vscode-foreground': r.textBody,
        '--vscode-sideBar-background': r.sidebarGround,
        '--vscode-sideBar-foreground': a(r.textBody, 'cc'),
        '--vscode-sideBarSectionHeader-background': r.sidebarGround,
        '--vscode-sideBarSectionHeader-foreground': r.textPrimary,
        '--vscode-sideBarSectionHeader-border': r.paneEdge,
        '--vscode-sideBarTitle-foreground': r.textDim,
        '--vscode-panel-border': r.paneEdge,

        // ── raised surfaces ────────────────────────────────────────────
        '--vscode-editorWidget-background': r.raisedSurface,
        '--vscode-editorWidget-border': r.hairline,
        '--vscode-widget-border': r.hairline,
        '--vscode-keybindingLabel-background': r.raisedSurface,

        // ── text ramp ──────────────────────────────────────────────────
        '--vscode-descriptionForeground': a(r.textPrimary, '80'),
        '--vscode-disabledForeground': a(r.textPrimary, '4d'),
        '--vscode-icon-foreground': a(r.textBody, 'ab'),
        '--vscode-tree-indentGuidesStroke': a(r.textDim, '70'),

        // ── selection, hover, focus ────────────────────────────────────
        '--vscode-focusBorder': r.focus,
        '--vscode-list-hoverBackground': a(r.hoverWash, '4d'),
        '--vscode-list-inactiveSelectionBackground': a(r.hoverWash, '40'),
        // A toolbar button hovers off the dim text step, not the list wash:
        // it sits in a title bar, over the pane's own ground.
        '--vscode-toolbar-hoverBackground': a(r.textDim, '4d'),
        // VS Code's own "no explicit contrast border" value. Every non
        // high-contrast theme sets it transparent; no role produces it.
        '--vscode-contrastBorder': '#00000000',

        // ── buttons ────────────────────────────────────────────────────
        '--vscode-button-background': a(r.primaryAction, '80'),
        '--vscode-button-foreground': r.textPrimary,
        '--vscode-button-hoverBackground': a(r.primaryAction, '99'),
        '--vscode-button-secondaryBackground': r.controlSurface,
        '--vscode-button-secondaryForeground': a(r.textPrimary, 'cc'),
        '--vscode-button-secondaryHoverBackground': r.hairline,
        '--vscode-button-secondaryBorder': r.controlSurface,

        // ── fields ─────────────────────────────────────────────────────
        '--vscode-input-background': r.inputSurface,
        '--vscode-input-border': r.hairlineStrong,
        '--vscode-input-foreground': r.textPrimary,
        '--vscode-input-placeholderForeground': r.textMuted,
        '--vscode-checkbox-background': r.inputSurface,
        '--vscode-checkbox-border': r.hairlineStrong,
        '--vscode-inputValidation-errorBackground': r.raisedSurface,
        // Bearded outlines the error field in its warning yellow rather than
        // its red. Kept as the theme wrote it, routed through the warn role.
        '--vscode-inputValidation-errorBorder': r.warn,
        '--vscode-inputValidation-infoBackground': r.raisedSurface,
        '--vscode-inputValidation-infoBorder': r.primaryAction,
        '--vscode-inputValidation-warningBackground': r.raisedSurface,

        // ── semantics ──────────────────────────────────────────────────
        '--vscode-charts-green': r.pass,
        '--vscode-charts-yellow': r.warn,
        '--vscode-charts-blue': r.running,
        '--vscode-testing-iconPassed': r.pass,
        '--vscode-list-warningForeground': r.warn,
        '--vscode-list-errorForeground': r.error,
        '--vscode-editorError-foreground': r.error,
        '--vscode-editorWarning-foreground': r.warn,

        // ── links and inline code ──────────────────────────────────────
        '--vscode-textLink-foreground': r.accent,
        '--vscode-textCodeBlock-background': a(r.accent, '33'),
        '--vscode-textPreformat-foreground': r.warn,

        ...palette.overrides,
    };
}

/**
 * Bearded Monokai Black, the palette every capture shipped in until now.
 *
 * Extracted from the locally-installed Bearded Theme
 * (beardedbear.beardedtheme), so stories render in the palette the extension
 * is actually developed against. Keys the theme does not define fall back to
 * its nearest surface or accent, mirroring VS Code's own derivation.
 *
 * Preserved byte for byte: `deriveVscodeVars` on these roles reproduces the
 * fifty-four variables the inline literal used to declare.
 */
export const beardedMonokaiBlack: CapturePalette = {
    bodyClass: 'vscode-dark',
    roles: {
        editorGround: '#141414',
        sidebarGround: '#0e0e0e',
        raisedSurface: '#212121',
        controlSurface: '#262626',
        inputSurface: '#1a1a1a',
        hairline: '#2e2e2e',
        hairlineStrong: '#3a3a3a',
        paneEdge: '#050505',
        focus: '#474747',
        textPrimary: '#c7c7c7',
        textBody: '#adadad',
        textMuted: '#616161',
        textDim: '#545454',
        accent: '#78dce8',
        primaryAction: '#8f8f8f',
        hoverWash: '#3b3b3b',
        pass: '#a9dc76',
        warn: '#ffd866',
        error: '#fc6a67',
        running: '#78dce8',
    },
    overrides: {
        // VS Code's stock current-line blue. Bearded never defines it, so it
        // is not a colour of this theme and no role can produce it.
        '--vscode-editor-lineHighlightBackground': '#1073cf2d',
        // Bearded's own orange for class symbols. One hue, one job, no role.
        '--vscode-symbolIcon-classForeground': '#ee9d28',
    },
};

/**
 * Constellation Violet, the active capture palette.
 *
 * Anchored to the marketing site's own tokens
 * (website/src/styles/tokens.css) so a screenshot dropped onto the site
 * belongs to the page instead of sitting on it as a grey rectangle.
 *
 * The three decisions worth recording:
 *
 * GROUND. The site's page ground is #0a0913. The editor takes #12101f, the
 * site's raised-surface step, roughly twice the page ground's luminance. An
 * editor needs the extra room: syntax colours, the four semantics and the
 * hover washes all have to separate from the ground and from each other,
 * which #0a0913 is too close to black to allow. The side bar keeps #0d0b1a,
 * so the pane order still reads editor-lighter-than-sidebar the way VS Code
 * dark themes do.
 *
 * TEXT. Primary, body and muted are the site ramp unchanged, at 15.81:1,
 * 9.05:1 and 6.78:1 on the editor ground. Dim is the one adjustment: the
 * site's #6f6994 is a caption colour on a 16px marketing page and lands at
 * 3.68:1 here, under AA, so the capture palette lifts the same hue to
 * #8781ae (5.16:1 on the editor ground, 5.35:1 on the side bar) for the pane
 * titles and tree guides it draws.
 *
 * ACCENT. Violet marks focus, selection, links and the primary action, and
 * nothing else. The grounds stay near-neutral violet-greys; a purple wash
 * over every surface would read worse than the theme it replaces.
 */
export const constellationViolet: CapturePalette = {
    bodyClass: 'vscode-dark',
    roles: {
        // Grounds, on the site's own ramp: page #0a0913 sits below all of
        // these, so a capture placed on the page separates from it.
        editorGround: '#12101f',
        sidebarGround: '#0d0b1a',
        raisedSurface: '#1c1834',
        controlSurface: '#241f3c',
        inputSurface: '#16132a',
        // Hairlines: the site's --border-panel outlines things that must be
        // seen against a raised surface, --rule is the quieter pane seam.
        hairline: '#2a2545',
        hairlineStrong: '#3a3357',
        paneEdge: '#1d1930',
        // Focus is the accent. In an editor, violet means "you are here".
        focus: '#8b5cf6',
        textPrimary: '#edeaf6',
        textBody: '#b6b0d2',
        textMuted: '#9d97bd',
        // Lifted off the site's #6f6994 to clear AA at editor sizes.
        textDim: '#8781ae',
        accent: '#a78bfa',
        primaryAction: '#8b5cf6',
        hoverWash: '#3f3862',
        // The semantics keep their meaning and their hue family. Each is
        // retuned for a violet ground, not rebranded: the green stays green.
        // Green off the yellow edge (h90 to h104) so it reads as green rather
        // than as a warm neighbour of the yellow. 11.83:1.
        pass: '#9ede86',
        // Yellow off full saturation, which blazes against violet. 12.85:1.
        warn: '#f5d27a',
        // Red desaturated 96% to 86% so it stops vibrating on violet. 6.72:1.
        error: '#f4736f',
        // Cyan nudged cooler (h186 to h191) so it reads as the complement of
        // the accent rather than as a teal. 11.03:1.
        running: '#74d4ea',
    },
    overrides: {
        // Same job as Bearded's stock blue wash, in this palette's accent:
        // the current line, tinted, at the alpha VS Code ships.
        '--vscode-editor-lineHighlightBackground': '#8b5cf62d',
        // The class-symbol hue. Amber, because every other symbol colour here
        // is cool and this one has to be told apart at glyph size.
        '--vscode-symbolIcon-classForeground': '#e9a44a',
    },
};

/** Bearded Vivid Light, the light option in the Storybook toolbar. */
export const beardedVividLight: CapturePalette = {
    bodyClass: 'vscode-light',
    roles: {
        editorGround: '#f4f4f4',
        sidebarGround: '#ebebeb',
        raisedSurface: '#f9f9f9',
        controlSurface: '#e2e2e2',
        inputSurface: '#f9f9f9',
        hairline: '#dbdbdb',
        hairlineStrong: '#c1c1c1',
        paneEdge: '#cecece',
        focus: '#c1c1c1',
        textPrimary: '#181818',
        textBody: '#000000',
        textMuted: '#a8a8a8',
        textDim: '#8a8a8a',
        accent: '#28a9ff',
        primaryAction: '#7e7e7e',
        hoverWash: '#8a8a8a',
        pass: '#00ac39',
        warn: '#d48700',
        error: '#D62C2C',
        running: '#0099ff',
    },
    overrides: {
        // On light, Bearded puts pure black on the button and drops the alpha
        // from the secondary label. Neither follows the dark theme's rule.
        '--vscode-button-foreground': '#000000',
        '--vscode-button-secondaryForeground': '#181818',
        // Supporting copy is 80% here and 50% on dark: on a light ground the
        // lighter step would fall out of legibility.
        '--vscode-descriptionForeground': '#181818cc',
        // Hover and inactive selection are far weaker on light (1a / 26) than
        // the 4d / 40 the dark themes use.
        '--vscode-list-hoverBackground': '#8a8a8a1a',
        '--vscode-list-inactiveSelectionBackground': '#8a8a8a26',
        // The tree's warning glyph is a brighter amber than the chart yellow,
        // which would disappear at glyph size on a light ground.
        '--vscode-list-warningForeground': '#FFB638',
        // Inline code is near-black brown here, not the warning yellow.
        '--vscode-textPreformat-foreground': '#3b2600',
        '--vscode-symbolIcon-classForeground': '#d67e00',
        '--vscode-editor-lineHighlightBackground': '#1073cf2d',
        // The theme writes its link colour uppercase and the code wash behind
        // it lowercase. Same colour; kept as written so the extraction is
        // byte-identical to the literal it replaced.
        '--vscode-textLink-foreground': '#28A9FF',
    },
};

/**
 * Constellation Light: the same brand on an inverted ground.
 *
 * WHY. Every capture used to be a dark editor on a dark page, so the frame
 * border and the glow behind it did all the work of separating the product
 * from the page, and they only half managed it. A light surface on the site's
 * near-black ground is the strongest separation available and costs nothing
 * but a re-shoot.
 *
 * WHAT CARRIES OVER. The accent stays violet and the semantics keep their
 * meaning: green passes, yellow warns, red fails, cyan is in flight. What
 * changes is the ramp direction, and every semantic is re-picked rather than
 * reused — the dark palette's #9ede86 sits at 1.6:1 on a white ground and
 * would be invisible.
 *
 * CONTRAST. Every text role clears AA against editorGround (#fbfaff):
 * textPrimary 16.1:1, textBody 9.6:1, textMuted 6.7:1, textDim 5.0:1,
 * accent 6.1:1. The semantics clear it too, at 5.4, 4.8, 5.0 and 5.1.
 */
export const constellationLight: CapturePalette = {
    bodyClass: 'vscode-light',
    roles: {
        // The ramp inverts: on light the side bar sits ABOVE the editor rather
        // than below it, and a raised surface goes to pure white.
        editorGround: '#fbfaff',
        sidebarGround: '#f3f1fa',
        raisedSurface: '#ffffff',
        controlSurface: '#ebe8f6',
        inputSurface: '#ffffff',
        hairline: '#e2ddf0',
        hairlineStrong: '#cdc5e4',
        paneEdge: '#e8e4f4',
        // Focus is the accent, darkened one step so it holds against white.
        focus: '#7c3aed',
        textPrimary: '#1a1626',
        textBody: '#3d3654',
        textMuted: '#5a5275',
        textDim: '#6f6890',
        accent: '#7c3aed',
        primaryAction: '#7c3aed',
        hoverWash: '#ddd6f3',
        // Re-picked, not reused. Each is the darkest step of its hue that
        // still reads as that colour rather than as brown or navy.
        pass: '#1f7a3d',
        warn: '#9a6b00',
        error: '#c0392b',
        running: '#0e7490',
    },
    overrides: {
        // The current-line wash inverts with the ground: on light it has to be
        // a tint, not a fill, or it swallows the text sitting on it.
        '--vscode-editor-lineHighlightBackground': '#7c3aed14',
        // The class-symbol hue. Amber again, but the dark palette's #e9a44a
        // drops below AA on white, so it goes two steps darker.
        '--vscode-symbolIcon-classForeground': '#b45309',
        // Supporting copy is 80% on light against 50% on dark: the lighter
        // step falls out of legibility once the ground is bright.
        '--vscode-descriptionForeground': '#3d3654cc',
        // Hover and inactive selection are far weaker on light than the 4d/40
        // the dark palettes use, for the same reason.
        '--vscode-list-hoverBackground': '#7c3aed14',
        '--vscode-list-inactiveSelectionBackground': '#7c3aed1f',
    },
};

/**
 * THE SWITCH. One line: which palette every story, screenshot and clip frame
 * renders in. Changing it means re-running every capture and re-rendering
 * every clip (docs/visual-assets.md).
 */
export const activeCapturePalette: CapturePalette = constellationLight;

/**
 * VS Code's high-contrast theme, built on whatever palette is active so a
 * retheme carries into it. Not a capture palette: no generated image uses it.
 */
export const highContrast: VsCodeVars = {
    ...deriveVscodeVars(activeCapturePalette),
    '--vscode-editor-background': '#000000',
    '--vscode-editor-foreground': '#ffffff',
    '--vscode-foreground': '#ffffff',
    '--vscode-sideBar-background': '#000000',
    '--vscode-sideBar-foreground': '#ffffff',
    '--vscode-sideBarSectionHeader-background': '#000000',
    '--vscode-sideBarSectionHeader-foreground': '#ffffff',
    '--vscode-sideBarSectionHeader-border': '#ffffff',
    '--vscode-sideBarTitle-foreground': '#ffffff',
    '--vscode-icon-foreground': '#ffffff',
    '--vscode-editorWidget-background': '#000000',
    '--vscode-contrastBorder': '#ffffff',
    '--vscode-focusBorder': '#ffff00',
    '--vscode-panel-border': '#ffffff',
};

/**
 * Font variables shared by every palette, mirroring the author's editor
 * settings. Part of the capture's look, so they live here with the colours.
 */
export const captureFontVars: VsCodeVars = {
    '--vscode-font-family': "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    '--vscode-editor-font-family': "'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
    '--vscode-editor-font-size': '12px',
};

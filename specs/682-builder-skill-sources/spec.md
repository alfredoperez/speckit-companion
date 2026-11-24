# Workflow Builder: where each skill comes from, and which skill hooks cannot run

**Source**: Workflow Builder Trial, gap 2 (a build accepts a skill that does not exist or that refuses model calls, with no warning)

## User Scenarios & Testing

### User Story 1 - A hook whose skill cannot run says so (Priority: P1)

A developer attaches a skill hook in the Workflow Builder, or writes one in `companion.yml` by hand. When the named skill is not in the project or an installed plugin, or the skill is marked so the assistant may not call it, the builder shows a plain reason on that hook, and the build and its preview print the same reason as a warning. The build still succeeds, because the developer may install the skill later.

**Why this priority**: today such a hook builds silently and then does nothing in a run, which is the trial's second-worst gap.

**Independent Test**: configure a hook naming a skill that does not exist and one naming a skill marked `disable-model-invocation`; run the graph and a build preview; both carry the reason, and the build exits successfully.

**Acceptance Scenarios**:

1. **Given** a skill hook naming `no-such-skill`, **When** the builder reads the pipeline, **Then** that hook carries a problem saying no skill of that name was found.
2. **Given** a skill hook naming a project skill marked `disable-model-invocation: true`, **When** the builder reads the pipeline, **Then** that hook carries a problem saying the assistant cannot call it from a hook.
3. **Given** either hook above, **When** the developer previews or runs the build, **Then** the output carries a warning with the same reason, and the build still writes its commands.
4. **Given** a skill hook naming a skill that exists and may be called, **When** the builder reads the pipeline, **Then** the hook carries no problem.
5. **Given** a hook named `superpowers:brainstorming` while the project holds a plain skill named `brainstorming` and no such plugin, **When** the builder reads the pipeline, **Then** the problem points out the project skill and says to drop the prefix.

### User Story 2 - The skill picker says where each skill comes from (Priority: P2)

When the builder offers skills for a hook, each one says whether it comes from this project (and which folder), from the developer's own skills, or from an installed Claude Code plugin, carries its one-line description, and says whether a hook can call it.

**Why this priority**: bare names cannot be told apart, and the picker never listed plugin skills at all.

**Independent Test**: a project with a skill under `.claude/skills` and a user home with an installed, enabled plugin carrying a skill; the graph lists both with their sources and descriptions.

**Acceptance Scenarios**:

1. **Given** a skill at `.claude/skills/house-check/SKILL.md` with a description, **When** the builder reads the pipeline, **Then** the skill list carries it with source `project`, its folder and its description.
2. **Given** an installed and enabled plugin `p` with skill `s`, **When** the builder reads the pipeline, **Then** the skill list carries `p:s` with source `plugin` and the plugin's name.
3. **Given** a plugin the developer turned off, **When** the builder reads the pipeline, **Then** its skills are listed as turned off, and a hook naming one carries a problem saying the plugin is off.

### Edge Cases

- No plugin registry, an unreadable one, or one in a shape this version does not know: plugin skills are left out, project skills are still listed, and no hook is flagged as missing because of it unless its name is plugin-style. A plugin-style name with no readable registry is reported as "could not be checked", not as missing.
- A skill file with no frontmatter or a malformed one: listed with an empty description and treated as callable.
- The same name in two project folders: listed once per folder; the hook check is satisfied if any copy is callable.
- A plugin installed for another project only: not offered here.
- A parked configuration (workflow `shipped`): its hooks carry problems too, since they would run once switched back.

## Requirements

### Functional Requirements

- **FR-001**: The builder's data MUST list every skill the project can use, each with its name, its source (project folder, the developer's own skills folder, or installed plugin), its description line, and whether the assistant may call it.
- **FR-002**: Plugin skills MUST be read only from Claude Code's installed-plugin registry and settings, and only for plugins installed for every project or for this project; when the registry cannot be read, plugin skills MUST be omitted rather than guessed.
- **FR-003**: A skill marked `disable-model-invocation: true` in its own frontmatter MUST be reported as not callable by a hook.
- **FR-004**: Every skill hook in the builder's data MUST carry a problem string, empty when the skill is found and callable, otherwise a plain reason the panel can show unchanged.
- **FR-005**: The build and its preview MUST print the same reason as a warning naming the step and hook, and MUST NOT fail because of it.
- **FR-006**: The editor's build report MUST carry the build's warnings as a list, so the panel can show them without parsing the log.
- **FR-007**: The skill check MUST be written once, in the spec-kit half, and read by both the builder's data and the build.
- **FR-008**: Existing fields and messages MUST keep their names and shapes; only new ones are added.

### Key Entities

- **Skill choice**: one skill the project can use. Name (what a hook writes), source, where (folder or plugin), description, callable, enabled.
- **Skill hook** *(existing)*: gains a problem string.
- **Build report** *(existing)*: gains a warnings list.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A hook naming a missing or uncallable skill shows a reason in the builder data and in 100% of build and preview runs.
- **SC-002**: Zero builds fail because of a skill problem.
- **SC-003**: Every listed skill carries a source; no plugin skill is listed for a plugin that is not installed for this project.

## Non-goals

- Changing the webview: another change draws these fields.
- Recording whether a hook actually ran (gap 1).
- Checking skills for providers other than Claude Code beyond the shared project folders.
- Turning a skill problem into a build failure.

## Change-level rules

- No new dependency; the spec-kit half stays standard library only.
- The pipeline's shape is still derived once, in the spec-kit scripts.
- Never remove or rename an existing protocol field or message.

## Verification plan

1. Unit tests build a throwaway project and a throwaway home folder, write skills and a plugin registry, and check the graph's skill list and per-hook problems.
2. A build preview test checks the warning text and a zero exit.
3. A host test checks the build report lifts the warnings out of the log.

## Assumptions

- The developer's own skills folder (`~/.claude/skills`) counts as a source, labelled `user`, because Claude Code loads it; it is not flagged even though teammates may lack it.
- A plugin not mentioned in any settings file is treated as enabled, since Claude Code enables a plugin when it installs it; only an explicit `false` turns it off.
- Plugin skills sit under the plugin's `skills/` folder; a plugin that declares other skill paths in its manifest is read from those too when they are plain relative paths.
- The existing `choices.skills` name list stays as it is; the new list is added beside it.

## Verbatim Constraints

- `disable-model-invocation`
- `.claude/skills`, `.agents/skills`, `.specify/skills`

# Research: Attach a hook from a list, not from memory

## The catalog travels with the graph, not in its own message

**Decision**: Build the installed-command list where `skills`, `nodes`, `fragments` and `presets` are built, and send it in the same message.

**Rationale**: Every other list the form offers already arrives that way, and the panel's rule is that structure is derived once and drawn elsewhere. A second fetch would be a second source that can disagree with the board beside it, and the failure would look like the picker being out of date rather than like two readers disagreeing.

**Alternatives considered**: A request-on-open message, which costs a round trip on every use and introduces a state where the form is open and the list has not arrived. A compiled-in list, which the issue rules out for the right reason: it lies about what is installed, and the lie is only found when the pipeline runs.

## Entries carry a description, not just a name

**Decision**: An offered entry is an identifier, a label, an optional description and an optional usual placement.

**Rationale**: The point of the change is that choosing should not require knowing. A list of `speckit.git.commit` beside `speckit.git.feature` asks the same knowledge the free-text box asked, one click earlier. Both registries already carry a description per hook, so the information exists and was simply not being passed on.

**Alternatives considered**: Names only, which is most of the work for none of the benefit.

## The picker is the panel's menu, not a type-ahead

**Decision**: Render the second selector with the same menu component the workflow picker uses, keeping the free-text input beside it.

**Rationale**: The existing affordance is a `datalist`, which only reveals itself once you start typing something that matches — so a person who does not know the name never sees it. It also has nowhere to put a description. The menu is already in this panel, already handles keyboard and a long list, and shows a note under each row, which is exactly the shape an entry has.

**Alternatives considered**: Keeping the type-ahead and adding descriptions to it, which `datalist` cannot render consistently across platforms. A separate dialog, which is the thing this panel was built to stop doing.

## Usual placement is informational

**Decision**: Show where a command normally attaches, and never use it to move or restrict the hook.

**Rationale**: The registry records a placement per lifecycle step, so the information is real. But a project may legitimately attach a hook anywhere, and a picker that refused would be enforcing a convention the pipeline itself does not enforce. Saying where it usually goes helps someone who does not know the pipeline; deciding for them does not.

**Alternatives considered**: Filtering the list by the anchor being edited, which hides valid choices and makes the list's contents depend on where you clicked.

## The same command registered twice is offered once

**Decision**: De-duplicate on the command identifier, keeping the first description seen.

**Rationale**: A registry places one command at several lifecycle steps by design — the automatic commit is registered at nine of them in a stock install. Offering it nine times would make the list unreadable and would say nothing true.

**Alternatives considered**: Grouping by step, which turns one choice into two and reintroduces the question of which step's copy to write.

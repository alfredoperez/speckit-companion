You are Claude Desktop with computer use on the real Mac. You only click, scroll and look. Do not run commands, install anything, type into VS Code, or write files: everything that needs a shell is already done, a script has already checked the viewer, the navigation, the Workflow Builder and the themes, and a recorder on the Mac saves screenshots of the QA windows on its own. Four short parts are left, about twenty minutes of clicking: do them in one sitting, since access lapses after thirty idle minutes. Reply with results in the format at the bottom and stop.

## Already set up

Your user's normal VS Code has SpecKit Companion {{VERSION}} installed. Three VS Code windows are open for this run (find them with the Window menu, and ignore every other window):

- **{{SANDBOX}}**: a todo app with demo specs. `Demo — Empty record` has no recorded activity, `Demo — Links` has a Links section, and `{{TIMED}}` has finished specify and waits for Plan.
- **{{STOCK}}**: spec-kit without SpecKit Companion.
- **two-roots**: both folders in one window.

Claude Code already trusts both folders, so the terminals it opens will not ask anything. Grant access to **Visual Studio Code** (click tier) and, for part D only, **GitHub Copilot**. Confirm the front window's title before each click. If a click is refused because the grant lapsed, request access again.

## Checks

Write PASS, FAIL or BLOCKED and one line of what you saw for each. For a FAIL, give the exact clicks.

**A. First open.** {{SANDBOX}} window.
1. If it shows Restricted Mode, note the SpecKit icon, Specs view and any popup before trusting. Nothing broken or empty is expected.
2. Trust the folder (banner or Manage). Open the SpecKit icon: the Specs view lists the specs in groups; clicking `Demo — Planned` opens a styled viewer with a header, a rail and the document. A blank or unstyled viewer is a FAIL: open Help > Toggle Developer Tools > Console and copy the first error.

**B. Stock and two roots.**
1. {{STOCK}} window: trust it, open the SpecKit icon. Write down each popup or banner, click its main button once, and say what happened.
2. two-roots window: trust it. Say which folder's specs the Specs view shows and which folder New Spec (+) targets. Cancel the form.

**C. One spec through VS Code's buttons.** {{SANDBOX}} window.
1. Click `{{TIMED}}`'s spec in the sidebar. The footer's forward button reads Next: Plan.
2. Click it. A terminal runs; do not click while it runs. Wait until Plan shows done and plan.md is open.
3. Click Next: Tasks, wait; click Next: Implement, wait (a few minutes). The spec ends Completed, under the Completed group. Look at the Overview's step times: each looks like seconds or minutes of work, not the time the spec sat idle.
4. If a terminal stops on a question you cannot click, do not wait on it and do not ask your user to type. Write `C<n> QUESTION:` with the step and the exact question, and go on to part D. Claude Code answers it from the Mac, and you are asked to finish part C afterwards.
Note the Mac clock time at each click and each settle.

**D. GitHub Copilot app.** Only if the app is up to date and signed in; otherwise BLOCKED with the reason.
1. Open the project `{{SANDBOX_PATH}}`, new session, send exactly `Open the SpecKit Companion canvas`. The board opens and the agent says it is waiting. Copy its reply.
2. On the board, New spec, pick Spec Kit, type `Add a Clear completed button.`, click Specify. The chat gets a message starting `/speckit-specify` (`/speckit.specify` in a project with no skill folders), ending with one sentence that names a run-instructions file under `.speckit-companion/prompts/`.

## Reply

One line per step, `A1 PASS: …`, `B1 FAIL: … clicks: …`, `C2 QUESTION: …`, and so on, then the clock times from C. Nothing else.

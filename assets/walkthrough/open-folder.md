### Where SpecKit lives

The SpecKit icon sits in the activity bar and is always there, folder or no folder.

With nothing open, the Specs view shows one action: **Open Folder**.

With a folder open, it lists every spec it finds under `specs/`, grouped by status, plus your steering documents and living specs.

### It reads before it writes

Opening a folder changes nothing on disk. The extension only reads what is already there, and writes only when you ask it to create a spec, seed the sample, or run a phase.

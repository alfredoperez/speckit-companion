---
id: verify-manually
name: Verify it by hand
kind: gate
command: implement
reads: [implement-exec]
---
**Stop and have a person use it.** Before this step is called done, write the click-through and hand it over.

Green tests are not the same claim as working software. A run can finish with every test passing, every review clean, and a button that does nothing — because the tests assert what the code does and nobody opened the thing. That is the failure this node exists for, and it is common enough to be worth a stop.

Write `<feature_directory>/verify.md` — one check per acceptance scenario in the spec, in the order a person would actually do them:

```markdown
# Verify by hand: [FEATURE NAME]

Each line is something to do and what should happen. Tick what you see, not what
you expect. A line you cannot do is a finding, not a skip.

- [ ] **Do:** open the todo list with three items, one starred
      **See:** the starred one shows a filled star; the others are outlines
- [ ] **Do:** click Starred in the header
      **See:** the list shows only the starred item, and the count reads 1
- [ ] **Do:** reload the page
      **See:** the star and the filter selection both survive

## What did not work

_(leave empty if everything above passed)_
```

Rules for writing it:

- **One line per acceptance scenario**, plus one per requirement that produced something visible. A scenario with no line means nobody will look at it.
- **Say what to do and what to see, separately.** "Check the filter works" is not a check; it asks the reader to invent the test and grade their own invention.
- **Start every path from a state the reader can reach**, not from where the implementation happened to be.
- **Include the boring ones.** The dead button is always on the path somebody assumed was fine.

Then **stop and ask the person to run it.** Do not mark the spec complete on your own reading of the code — the point of this node is the pair of eyes that is not yours. When they report back, record what they found:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --concerns "<what failed the click-through, or 'verified by hand'>"
```

Anything that failed is work in this spec, not a follow-up: it is a requirement that was reported done and is not.

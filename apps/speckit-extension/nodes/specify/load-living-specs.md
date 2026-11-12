---
id: load-living-specs
name: Load living specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs. Run the recorder; never judge the gate yourself.** Name the surface this change lands on from the request (a directory is enough) and run:
```bash
python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <in-scope files or directories…>
```
It is silent when the project keeps no living specs: then draft as usual. When it prints `Recorded living specs (…)`, read `.specify/extensions/companion/commands/reference/living-specify-load.md` and follow it before drafting. It must never fail or slow the command.

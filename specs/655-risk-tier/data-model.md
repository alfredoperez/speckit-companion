# Data Model

`risk` on the run record: `tier` (`low|normal|high`, in force), `computed` (the tier from the files), `reasons` (strings), `raised` (optional `{tier, reason, by, at}`). `tier = max(computed, raised.tier)`. A raise replaces an earlier raise only with a higher tier.

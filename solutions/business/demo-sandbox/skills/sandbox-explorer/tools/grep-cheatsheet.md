# `grep` under just-bash

Standard POSIX `grep` with the flags you'd expect.

| Flag | Effect |
|---|---|
| `-r` / `-R` | recurse into directories |
| `-l` | print only filenames that match (great for triage) |
| `-i` | case-insensitive |
| `-n` | show line numbers |
| `-E` | extended regex (alternation `|`, grouping) |
| `-A 2` / `-B 2` / `-C 2` | print 2 lines After / Before / Context around match |
| `--include='*.md'` | restrict to file extensions |

## Patterns for the demo data

```bash
# "which customers mention churn risk?"
grep -l -i "churn\|at-risk\|renewal" entities/customers/*.md

# "where's MRR defined?"
grep -n "MRR" resources/glossary.md

# "any plan items over $50k?"
grep -E "\\$[5-9][0-9],[0-9]{3}|\\$[0-9]{3,},[0-9]{3}" entities/plans/*.md

# multi-file ranking
grep -c "expansion" entities/customers/*.md | sort -t: -k2 -nr
```

## Speed tip

For JSON files prefer `cat foo.json | grep` over recursive grep on
arbitrary binaries — `grep -r` will scan everything including the JSON,
which is usually what you want, but the output is noisier than reading
the JSON directly with `cat` + your eyes.

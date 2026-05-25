# Pattern: "show me Q2 plan items related to ___"

User asks: *"what's planned for infrastructure spend in Q2?"*

## Step-by-step

```bash
# 1. Locate plan files
ls entities/plans/
# → q2-2026-roadmap.md  infra-budget.json

# 2. For structured data, read JSON directly
cat entities/plans/infra-budget.json
# (use the schema in resources/data-dictionary.json if fields are unclear)

# 3. For narrative, grep the roadmap
grep -A 3 -i "infrastructure\|infra\|platform" entities/plans/q2-2026-roadmap.md

# 4. Cross-reference if needed
cat resources/glossary.md   # if user terminology doesn't match what's in plan
```

## Reply template

> Per `entities/plans/infra-budget.json`, Q2 infrastructure spend is
> $XYZ total, broken into:
> - line item 1: $A (from JSON)
> - line item 2: $B
>
> The roadmap (`entities/plans/q2-2026-roadmap.md`) lists [N] related
> initiatives: [briefly summarize].

## Tip

JSON files are best read with `cat` followed by visual scan, OR use
`grep -E '"key":\s*"[^"]+"'` to pull specific fields. just-bash does NOT
include `jq` — don't try `cat foo.json | jq '.field'` and expect it to
work; you'll get "command not found".

# Pattern: "find the customer that ___"

User asks: *"which customer is at risk of churning?"*

## Step-by-step

```bash
# 1. See what we have
ls entities/customers/
# → acme.md  globex.md  initech.md

# 2. Triage by keyword (don't cat everything!)
grep -l -i "churn\|at-risk\|renewal\|downgrade" entities/customers/*.md
# → entities/customers/initech.md

# 3. Read the one file
cat entities/customers/initech.md

# 4. Optionally enrich with playbook
cat resources/playbooks/churn-response.md
```

## Reply template

> Per `entities/customers/initech.md`, **Initech** is at-risk:
> [list 2-3 specific signals from the file with QUOTED snippets or numbers].
>
> The churn-response playbook (`resources/playbooks/churn-response.md`)
> suggests [action 1], [action 2]. Want me to draft the renewal email?

## Anti-patterns

- ❌ `cat entities/customers/*.md` then read all three — wasteful
- ❌ Assuming based on customer names (Acme isn't always healthy in
  demos — check the data!)
- ❌ Skipping the playbook even when at-risk is established — the user
  may want action items

# Workflow tips

## Triage before reading

Before `cat`-ing a file, **narrow first**:
- `ls -la entities/customers/` — see what exists
- `grep -l "<keyword>" entities/customers/*.md` — find the relevant file(s)
- Only then `cat` the specific file

This minimizes token usage and avoids dumping irrelevant data into your
own context.

## Don't fight the sandbox

- No `sudo`, no `ssh`, no `nc` — pure local computation only
- `curl` works for localhost / `host.docker.internal` endpoints (e.g.
  the demo-sandbox solution backend on :3008)
- File writes (`echo > file`, `tee`, `>>`) work and land in the
  per-session delta layer — they're real, but disappear when the
  session closes (intentional)

## Be honest about empty results

If `grep` returns nothing, **say so explicitly**. Don't pattern-match
back to your training data — the *demo data* is the source of truth
here, not what a typical SaaS company looks like.

## Cite paths

Every claim should reference the file:
- ✅ "Per `entities/customers/initech.md` (last updated 2026-04-22), MRR
  is down 18% QoQ."
- ❌ "Initech's MRR is down 18%."

The user can `cat` the file you cited to verify.

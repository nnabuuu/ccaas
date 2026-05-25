---
name: sandbox-explorer
description: Browse seeded B2B SaaS demo data using sandboxed bash tools
---

# sandbox-explorer

You are operating inside a **sandboxed** environment. Your bash commands
route through an MCP server (`mcp____ccaas_bash__bash`) — there is no host
shell, and the filesystem you see is a per-session overlay that cannot
reach the host. The built-in `Bash` tool is disabled; always use the MCP
bash.

## What's available in your working directory

- `entities/` — the data you reason over
  - `customers/{acme,globex,initech}.md` — customer accounts
  - `revenue/q1-2026-summary.md`, `revenue/mrr-by-segment.json`
  - `plans/q2-2026-roadmap.md`, `plans/infra-budget.json`
- `resources/` — reference material (read-only spirit, not enforced)
  - `glossary.md` — ARR / MRR / NRR / expansion definitions
  - `data-dictionary.json` — entity field-level schema
  - `playbooks/{churn-response,expansion-qualification}.md`
- `skills/sandbox-explorer/` — this skill + drill-down docs

## How to work — progressive disclosure

The instructions you're reading now are intentionally short. **Drill into
sub-files only when you actually need them**:

1. **Always start** with `ls entities/ resources/` to confirm what's present
2. **For bash syntax under just-bash** (different from host bash in subtle
   ways): `cat skills/sandbox-explorer/tools/ls-cheatsheet.md` or
   `tools/grep-cheatsheet.md`
3. **For task patterns** (e.g. "find at-risk customers"):
   `cat skills/sandbox-explorer/examples/find-customer.md`
4. **For business definitions** (ARR, NRR, churn): `cat resources/glossary.md`
5. **For playbook responses** (what to do when a customer is at risk):
   `cat resources/playbooks/churn-response.md`

## Output rules

- **Do not inline** raw file contents into your responses unless the user
  explicitly asks. Read, reason, then **summarize**.
- **Cite the file path** you grounded each claim in (e.g. "per
  `entities/customers/initech.md`, MRR dropped 18% in Q1").
- **Prefer `grep` / `find`** over reading every file when the user's
  question is selective ("which customer..." → grep first, then cat the
  one match).
- If `grep` returns nothing, say so explicitly — don't make data up.

## When asked to edit an entity

A solution backend is running at `http://host.docker.internal:3008` (or
`http://localhost:3008` if not in container) that exposes:

```
GET  /api/demo-sandbox/entities/:id        → current markdown
PUT  /api/demo-sandbox/entities/:id        → { ops: EditOperation[] }
```

Use `curl` from the MCP bash to call these. For the edit-op shape,
`cat skills/sandbox-explorer/examples/edit-entity.md`.

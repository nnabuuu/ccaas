# TODOS

Deferred items from /plan-ceo-review (2026-03-20). Tracked for future implementation.

## P2 — Post-Concierge Phase

### Skill Analytics Dashboard
**What:** Per-skill analytics view in admin-next: session count, avg duration, token usage, satisfaction signal.
**Why:** Professors need impact reporting ("your methodology was used 47 times"), clients need ROI numbers.
**Effort:** M (human: ~1 week / CC: ~30 min)
**Depends on:** At least 1 customer actively using Skills in production.
**Context:** Deferred from Concierge MVP scope expansion. Build after first customer validates the model.

### Skill IP Audit Trail
**What:** Audit log for skill access: sync-to-session events, inline injection events, per-skill usage reports for professors.
**Why:** Trust infrastructure for IP monetization. Professors need proof their content is protected.
**Effort:** S (human: ~3 days / CC: ~20 min)
**Depends on:** AuditService (exists). Related to Skill Analytics but independent.
**Context:** Deferred from Concierge MVP scope expansion. Build when multiple professors contribute.

## P3 — Scaling Phase

### Skill Packaging CLI
**What:** `npm run skill:scaffold` — structured methodology interview → SKILL.md template + solution.json + directory structure.
**Why:** Compresses professor onboarding from "interview + write from scratch" to "interview + review template." Foundation for future self-serve wizard.
**Effort:** S (human: ~2 days / CC: ~15 min)
**Depends on:** Understanding of real professor onboarding workflow (learned during concierge).
**Context:** Deferred from Concierge MVP scope expansion. Build when manual process is painful (10+ skills).

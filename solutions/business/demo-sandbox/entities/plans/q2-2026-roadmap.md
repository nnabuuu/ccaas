---
period: 2026-Q2
owner: leadership-team
status: approved
approved_at: 2026-04-15
---

# Q2 2026 Roadmap

Three strategic themes, ranked by investment.

## Theme 1 — Platform reliability & infra

**Goal**: cut p99 latency by 30%, eliminate the 2 ongoing
multi-region failover gaps surfaced in Q1 incident reviews.

**Owners**: Platform team (Sarah K), Infra team (Devon M)
**Key initiatives**:
- Migrate the legacy event bus to the new managed queue (Kafka → MSK)
- Add active-active failover for the eu-west region
- Per-tenant rate limit refactor to use the new limiter primitive

**Budget**: see `entities/plans/infra-budget.json`

## Theme 2 — Expansion-led growth

**Goal**: convert 4 enterprise expansion opportunities into closed-won
ARR ($150k target).

**Owners**: Sales (Marcus R), CS (Priya P)
**Key initiatives**:
- Acme adjacent-team deal (Data Platform, $40k target)
- Globex tier-jump to 50 seats ($24k target)
- Two undisclosed enterprise deals in pipeline ($86k combined)

**Cross-team dependency**: Platform Theme 1 work blocks Acme expansion —
the Data Platform team's evaluation hinges on the eu-west failover
landing first.

## Theme 3 — At-risk retention

**Goal**: save Initech ($120k ARR) renewal in Jul; no other surprise
churns.

**Owners**: CS (Marcus R, Priya P)
**Key initiatives**:
- Execute the churn-response playbook for Initech
  (see `resources/playbooks/churn-response.md`)
- Build the churn-risk dashboard so future Initechs are caught Q-1, not
  Q-flip-of-the-coin

**Stretch**: 0 unplanned churns in mid-market segment for the quarter.

## Out of scope for Q2

- AI-native features (deferred to Q3)
- New region launch (waiting on Theme 1 to land first)
- Pricing changes (next review Q4)

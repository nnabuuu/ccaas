# B2B SaaS glossary

Terms used throughout the demo entities. Reach for this when a user's
question uses jargon that doesn't appear verbatim in the entity files.

## Revenue & retention

- **ARR** — Annual Recurring Revenue. Contracted value normalized to one
  year. For monthly subscribers: `MRR × 12`.
- **MRR** — Monthly Recurring Revenue. Sum of subscription fees due each
  month from active accounts.
- **NRR** (Net Revenue Retention) — `(starting ARR + expansion -
  contraction - churn) / starting ARR`, measured over the trailing 12
  months. `> 1.0` = expansion outpaces churn.
- **GRR** (Gross Revenue Retention) — same as NRR but excludes
  expansion. Floor of `1.0` not possible; pure indicator of stickiness.
- **Gross churn** (logo churn) — `lost customers / starting customer
  count` over a period. Independent of $ — measures how many *accounts*
  walked.

## Account lifecycle

- **Expansion** — additional ARR from an existing customer
  (more seats, higher tier, new product). Drives NRR above 1.0.
- **Contraction** — reduction in ARR from an existing customer (fewer
  seats, lower tier) without full churn.
- **Churn** — customer cancels in full at end of contract.
- **At-risk** — qualitative label applied when churn-risk score > 0.5 OR
  exec sponsor turnover OR usage decline > 15% QoQ.
- **Renewal** — contract end-of-term decision point. The 90-day window
  before the renewal date is the "renewal cycle."

## Customer segments

- **Enterprise** — ARR ≥ $100k, formal procurement, dedicated CSM
- **Mid-market** — $25k ≤ ARR < $100k, semi-formal procurement
- **SMB** — ARR < $25k, self-serve or low-touch sales

## Operational

- **QBR** — Quarterly Business Review. Customer-facing call where CSM
  presents usage trends, surfaces friction, asks for renewal/expansion.
- **Exec sponsor** — the customer-side senior leader who advocates for
  the product internally. Sponsor turnover is the single strongest
  leading indicator of churn.
- **CSM** — Customer Success Manager. Owns the post-sale relationship.

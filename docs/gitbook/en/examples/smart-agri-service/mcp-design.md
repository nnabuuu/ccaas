# MCP Design: Multi-Source Data Integration

This page examines how Smart Agri Service organizes 11 MCP tools to integrate data from multiple sources (farmer records, government policies, financial products) into a coherent analysis pipeline.

## Tool Orchestration Pattern

The Skill system prompt specifies a strict tool call sequence. This prevents the AI from calling tools out of order or skipping dependencies:

```
get_farmer_by_phone          ← Entry point (verify farmer exists)
    ↓
get_farmer_land              ← Land assets
get_farmer_crops             ← Income data (depends on land context)
get_farmer_equipment         ← Equipment assets
get_farmer_loans             ← Credit history
    ↓
get_farmer_summary           ← Computed aggregates (depends on all above)
    ↓
search_gov_policies          ← Match applicable policies
get_policy_document          ← Full text for high-relevance matches
search_loan_products         ← (Bank mode only) Match loan products
get_market_prices            ← Current market data
    ↓
write_output × 7 or 8       ← Progressive output to frontend
```

### Why Enforce Order?

Without enforced ordering, the AI might:
- Call `get_farmer_summary` before individual data tools (missing data for aggregation)
- Skip `get_policy_document` (missing citation sources)
- Call `write_output` before collecting all data (incomplete analysis)

The `appendSystemPrompt` in `solution.json` makes the sequence mandatory.

## Three Data Source Categories

### Category 1: Farmer Records (Relational)

Five tools query normalized SQLite tables linked by `farmer_id`:

```
farmers ──1:N──→ land_parcels
        ──1:N──→ crop_records
        ──1:N──→ equipment
        ──1:N──→ loan_history
```

**Design choice: Individual tools per table vs. single "get all" tool**

Individual tools were chosen because:
- The AI can describe what it learned at each step (better UX for progress tracking)
- Smaller response payloads per tool call
- Clearer tool activity timeline in the frontend

### Category 2: Reference Data (Search)

Two search tools with filter parameters:

| Tool | Filters | Design Note |
|------|---------|-------------|
| `search_gov_policies` | category, region, crop\_type, keyword | Returns metadata only (excludes `full_text` for bandwidth) |
| `search_loan_products` | bank\_name, min/max amount, keyword | Filters by eligibility criteria |

**Bandwidth optimization**: `search_gov_policies` returns a `has_full_text` flag. The AI only calls `get_policy_document` for high-relevance matches, avoiding transferring full policy documents unnecessarily.

### Category 3: Computed Aggregates

`get_farmer_summary` calculates metrics on-the-fly rather than storing materialized views:

- `total_land_mu`, `total_owned_land_mu`, `total_rented_land_mu`
- `latest_year_revenue`, `latest_year_cost`, `latest_year_profit`
- `avg_yield_per_mu`
- `total_equipment_value`, `total_subsidy_received`
- `active_loans_count`, `active_loans_total`, `has_overdue`
- `credit_score_factors` (computed risk signals)

**Why compute rather than materialize?** The dataset is small (50 demo farmers) and queries are infrequent. Computing on-the-fly avoids stale data and simplifies the data model.

## The write\_output Protocol

The `write_output` tool bridges AI analysis and frontend rendering:

```typescript
write_output(field: SyncField, value: unknown, preview: string)
```

- `field` must be one of the predefined sync fields (7 for farmer mode, 8 for bank mode)
- `value` can be string (markdown), JSON array (opportunities), or JSON object (loan recommendation)
- `preview` is shown on the sync button in the UI

The tool returns a structured result that CCAAS intercepts and broadcasts via SSE:

```json
{
  "data": { "field": "narrative_profile", "value": "...", "preview": "..." },
  "status": "success"
}
```

### Mixed Value Types

Different fields use different value types, demonstrating the flexibility of `write_output`:

| Field | Value Type | Example |
|-------|-----------|---------|
| `narrative_profile` | string (markdown) | Narrative farmer description |
| `opportunity_list` | JSON array | `[{ title, category, urgency, potential_benefit }]` |
| `policy_matches` | JSON array with IDs | `[{ policy_id, policy_name, relevance, action }]` |
| `loan_recommendation` | JSON object | `{ product_name, recommended_amount, rationale }` |

The frontend's `NarrativeCard` component detects the value type and renders accordingly.

## Transferable Patterns

### Pattern 1: Ordered Tool Pipeline

When your analysis has clear data dependencies, enforce tool call order in the session template's `appendSystemPrompt`. This produces predictable tool activity timelines and better progress indicators.

### Pattern 2: Search + Detail Split

For large documents (policies, manuals, specifications), split into:
- **Search tool**: Returns metadata + relevance flag (lightweight)
- **Detail tool**: Returns full content (on-demand)

This prevents context window bloat from unnecessary document transfers.

### Pattern 3: Computed Summary Tool

When you need aggregated metrics from multiple data sources, create a dedicated summary tool rather than asking the AI to calculate. This ensures consistent computation and keeps the AI focused on analysis rather than arithmetic.

### Pattern 4: Dual Persona from Single Data

The same 11 tools power two completely different user experiences. The differentiation happens entirely in the Skill layer (persona, tone, output field selection), not in the data layer. This pattern works for any domain where the same data serves different audiences.

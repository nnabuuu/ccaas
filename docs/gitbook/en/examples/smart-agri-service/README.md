# Smart Agri Service

Smart Agri Service is a production-grade AI agricultural advisory platform that demonstrates the **MCP + Dual Template** architecture pattern. One dataset powers two completely different user experiences through separate Skills and session templates.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│  Frontend (React 18)                                  │
│  ┌─────────────────┐  ┌───────────────────────────┐   │
│  │  ChatPanel       │  │  FarmerProfilePanel (7)   │   │
│  │  (SSE stream)    │  │  CreditReportPanel  (8)   │   │
│  └────────┬─────────┘  └───────────────────────────┘   │
├───────────┼────────────────────────────────────────────┤
│  CCAAS Core Backend (:3001)                           │
│  Session management, Skill routing, MCP orchestration │
├───────────┼────────────────────────────────────────────┤
│  MCP Server (11 tools)          stdio transport       │
│  Data fetchers + Summary + Reference data + write_output│
├───────────┼────────────────────────────────────────────┤
│  Solution Backend (:3003)       NestJS + SQLite       │
│  farmers, land, crops, equipment, loans, policies     │
└───────────────────────────────────────────────────────┘
```

## Dual-Mode Design

The same dataset supports two distinct personas through different Skills:

| Aspect | Farmer Advisor | Bank Assessor |
|--------|---------------|---------------|
| **Persona** | Warm village technician | Professional credit analyst |
| **Tone** | Friendly, actionable | Formal, data-driven |
| **Output Fields** | 7 fields | 8 fields |
| **Key Output** | opportunity\_list, policy\_matches | loan\_recommendation, risk\_assessment |
| **Session Template** | `farmer-advisor` | `bank-assessor` |

Each mode uses the same MCP tools but produces fundamentally different analysis through Skill instructions.

## 11 MCP Tools

The MCP server provides tools across three categories:

### Data Fetchers (5 tools)

| Tool | Input | Output |
|------|-------|--------|
| `get_farmer_by_phone` | 11-digit phone | Complete farmer record |
| `get_farmer_land` | farmer\_id | Land parcels with area, type, irrigation |
| `get_farmer_crops` | farmer\_id, year? | Crop records with yields, revenue, costs |
| `get_farmer_equipment` | farmer\_id | Equipment with purchase values, subsidies |
| `get_farmer_loans` | farmer\_id | Loan history with repayment status |

### Summary & Reference (5 tools)

| Tool | Purpose |
|------|---------|
| `get_farmer_summary` | Computed aggregates (total land, profit, credit score factors) |
| `search_gov_policies` | Filter policies by category, region, crop type |
| `get_policy_document` | Full policy text with section numbers for citation |
| `search_loan_products` | Filter bank products by amount, rate, term |
| `get_market_prices` | Current market data (grain prices, input costs, trends) |

### Output Sync (1 tool)

| Tool | Purpose |
|------|---------|
| `write_output` | Sync structured fields to frontend via SSE |

## Output Synchronization

The `write_output` tool is called once per field during analysis. The frontend receives each update via SSE and renders fields progressively:

**Farmer Mode (7 fields):**
`narrative_profile` > `farming_analysis` > `opportunity_list` > `policy_matches` > `action_plan` > `risk_factors` > `market_outlook`

**Bank Mode (8 fields):**
`credit_narrative` > `farmer_background` > `asset_summary` > `income_analysis` > `repayment_history` > `risk_assessment` > `loan_recommendation` > `collateral_evaluation`

## Policy Citation

The farmer advisor can cite specific policy clauses with verifiable links:

```markdown
Based on [Article 2 of the Cropland Fertility Protection Subsidy](/policy/abc123#section=2&text=subsidy-rate-125-per-mu),
you can receive a subsidy of 125 yuan per mu.
```

The frontend renders these as clickable links to a policy detail page with section highlighting.

## What Makes This Architecture Interesting

1. **One dataset, two personas** -- Same MCP tools power completely different UX through Skill instructions alone
2. **Progressive field rendering** -- `write_output` + SSE enables real-time structured updates without waiting for full analysis
3. **Verifiable AI claims** -- Policy citations link to original documents with specific clause highlighting
4. **Session persistence** -- Users can resume past analyses instantly from persisted `output_update` events

## Deep Dive

- [MCP Design: Multi-Source Data Integration](mcp-design.md) -- How 11 tools organize data from farmers, policies, and financial products

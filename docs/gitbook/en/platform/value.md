# Core Value: Human-in-the-Loop Co-Pilot

## Why Human-in-the-Loop

Enterprises face a dilemma when adopting AI:

| Approach | Problem |
|----------|---------|
| **Full Automation** | High risk, lack of control, no audit trail, costly errors |
| **Fully Manual** | Low efficiency, high cost, does not scale |
| **KedgeAgentic Approach** | AI executes + human oversight, balancing efficiency and safety |

KedgeAgentic adopts a **Co-Pilot model**: AI Agents handle repetitive tasks while human operators review, correct, and make decisions. Every action is traceable, and every change is versioned.

## Core Value Propositions

### 1. Collaboration, Not Replacement

KedgeAgentic does not aim to fully replace humans. Instead, it makes AI an effective assistant:

- AI produces initial drafts; humans review and refine
- After human edits, AI understands the changes and continues (Continue workflow)
- Full version control with one-click rollback

### 2. AI Engine Agnostic

KedgeAgentic is not tied to any specific AI vendor. It supports multiple AI backends through a standardized adapter interface:

- Commercial Agent runtimes (e.g., Claude Code, Cursor, Windsurf)
- Open-source Agents (e.g., OpenCode, Aider, Continue)
- Native LLM APIs (e.g., OpenAI, Anthropic, Gemini)
- Enterprise in-house Agents

### 3. Seamless Legacy System Integration

Over 70% of enterprise applications have been running for more than 10 years and lack modern APIs. KedgeAgentic provides multiple integration methods:

- **Browser Automation** -- Interact with web interfaces via Playwright
- **REST API Integration** -- Standardized API connectors
- **Webhooks** -- Event-driven system notifications
- **Preview Mode** -- Human confirmation before submission, with screenshot-based auditing

### 4. Enterprise-Grade Governance

- **Multi-Tenant Isolation** -- Database-level tenant isolation
- **Audit Logging** -- Immutable, complete operation logs
- **Version Control** -- Automatic versioning on every change with diff comparison and one-click restore
- **Access Control** -- Role-Based Access Control (RBAC)
- **Compliance** -- AES-256 encryption at rest + TLS 1.3 encryption in transit

## Typical Use Cases

### Finance and Accounting

- Automated invoice recognition and entry with human review and confirmation
- Automated expense report generation with financial staff approval
- AI-drafted monthly/quarterly reports refined by analysts

### Operations and Management

- Batch data entry with spot-check verification by operations staff
- System-to-system data migration supervised by administrators
- Automated document organization and archiving with manual classification review

### Education and Training

- AI-assisted lesson plan design with teacher review and editing
- Intelligent problem analysis and explanation, refined by curriculum specialists
- Automated course resource matching with teacher confirmation

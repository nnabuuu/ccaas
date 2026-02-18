# Core Value: Describe Your Business, AI Does the Rest

## The Problem: AI Doesn't Know Your Business

Without persistent context, every AI interaction starts from zero. You explain your systems, your workflows, your domain rules — and next session, you do it again. AI stays a generic assistant, not a domain expert.

This isn't a model quality problem. It's a platform problem.

## The Solution: Skills + MCP

KedgeAgentic solves this with two primitives:

| Layer | What It Does | Who Defines It |
|-------|-------------|----------------|
| **Skills** | Business logic — workflows, rules, domain knowledge | Solution developer |
| **MCP** | Tools & data — systems, APIs, information sources | Solution developer |
| **Platform** | Execution — Agent lifecycle, sessions, orchestration | KedgeAgentic |

Once defined, Skills and MCP tools are available to every Agent session. The AI knows your business from the first message.

## Core Value Propositions

### 1. Describe Once, Apply Everywhere

Skills encode your business logic permanently:

- Define a workflow in a Skill; AI applies it consistently across all sessions
- Update the Skill; every future session uses the new logic immediately
- No per-session prompting, no context rebuilding

### 2. Connect Tools and Data via MCP

MCP gives AI structured access to your systems:

- Connect REST APIs, databases, and services as MCP tools
- AI can query, read, and act on real data — not just talk about it
- Tools are available to every Agent without per-session configuration

### 3. Platform-Managed Infrastructure

The platform handles what you shouldn't have to:

- **Agent Engine Lifecycle** -- Start, stop, and recover Agent sessions automatically
- **Session Persistence** -- Conversation history and context survive across sessions
- **Context Management** -- Business context from Skills and MCP flows into every interaction
- **Tool Orchestration** -- MCP tools are routed, called, and results integrated automatically

### 4. Enterprise-Grade by Default

- **Multi-Tenant Isolation** -- Database-level tenant isolation
- **Audit Logging** -- Immutable, complete operation logs
- **Session Recovery** -- Resume interrupted sessions without losing context
- **Access Control** -- Role-Based Access Control (RBAC)

## Typical Use Cases

### Scheduled Execution

- Nightly system health checks with AI-generated reports
- Scheduled data analysis and anomaly detection
- Automated reporting with domain-specific interpretation

### Lesson Plan Design

- AI designs lesson plans using Skills that encode curriculum standards
- Teachers review and refine; AI applies edits in context
- MCP connects to course libraries, assessment tools, and learning management systems

### Business Analysis

- AI conducts structured analysis using McKinsey-style frameworks defined in Skills
- Connects to internal data sources via MCP for real numbers
- Produces consistent, repeatable analytical outputs

### System Monitoring

- AI monitors system health using Skills that define what "normal" means for your infrastructure
- MCP tools connect to logging, metrics, and alerting systems
- Anomalies trigger structured investigation workflows

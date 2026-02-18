# What is KedgeAgentic

KedgeAgentic is an **Agentic services platform** — you describe your business logic, and the platform runs it as a production-grade AI service.

## The Problem

AI is powerful, but it doesn't know your business. Every new integration requires rebuilding context from scratch: what your systems do, what your workflows look like, what your data means. Without persistent business context, AI stays a generic assistant — not a domain expert.

## The Solution

KedgeAgentic introduces two primitives that give AI permanent knowledge of your business:

- **Skills** — Describe your business logic once. Skills encode workflows, rules, and domain knowledge that the AI applies consistently across every session.
- **MCP** — Connect your tools and data once. MCP (Model Context Protocol) provides AI with structured access to your systems, APIs, and information sources.

The platform handles everything else: Agent Engine lifecycle, session persistence, context management, and tool orchestration. You describe the business; the platform runs it.

## Core Philosophy

- **Describe, don't program** — Express business logic in Skills; the AI handles execution
- **Persistent context** — Business knowledge accumulates across sessions, not rebuilt each time
- **Platform-managed infrastructure** — Agent Engines, sessions, and tools are managed by the platform
- **Production-grade** — Built for real workloads: multi-tenant isolation, audit logging, session recovery

## Who Uses KedgeAgentic

| Role | What They Build | How They Use It |
|------|-----------------|-----------------|
| Developer | Solutions (Skills + MCP + frontend) | Define skills, configure MCP, deploy |
| Business Team | Domain workflows | Describe business logic in Skills |
| End User | Agentic applications | Interact with the running service |

## Quick Navigation

- **Decision Maker?** Read the [Platform Overview](platform/) to understand KedgeAgentic's value and capabilities
- **Developer?** Jump to [Getting Started](getting-started/) to build your first Solution
- **Need integrations?** Check out the [Developer Guide](guide/) and [API Reference](api/)

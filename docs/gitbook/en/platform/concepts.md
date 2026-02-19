# Key Concepts

This page defines the core concepts in KedgeAgentic. Understanding these terms will help you navigate the documentation and design your Agentic services correctly.

---

## Workspace

**A Workspace is one end-user account.**

Each Workspace represents a single end user of your Agentic service. When you build a solution on KedgeAgentic and deploy it to your users, each user gets their own Workspace. Workspaces are fully isolated — an end user can only access their own sessions, files, and conversation history.

```
Your Agentic Service
├── Workspace A  ←  End User Alice
│   ├── Session 1
│   ├── Session 2
│   └── files/
├── Workspace B  ←  End User Bob
│   ├── Session 1
│   └── files/
└── Workspace C  ←  End User Carol
    └── ...
```

**What Workspace limits mean in practice:**

| Plan | Workspace Quota | Meaning |
|------|-----------------|---------|
| Free | 20 | Up to 20 end users |
| Starter | 500 | Up to 500 end users |
| Business | 5,000 | Up to 5,000 end users |
| Enterprise | Custom | Negotiated |

The Workspace quota is the ceiling for how many concurrent end-user accounts your service can hold. It is **not** a per-session or per-request limit.

---

## End User

An **End User** is the person who uses the Agentic service you built. End users interact with the running service — they send messages, upload files, review Agent outputs, and apply results to their work. They do not configure Skills or MCP Servers; that is the Solution Developer's responsibility.

**End User vs. Solution Developer:**

| | Solution Developer | End User |
|---|---|---|
| **What they do** | Build the Agentic service (Skills, MCP, backend) | Use the running service |
| **What they interact with** | Platform admin, `solution.json`, code | Your custom frontend UI |
| **Platform visibility** | Full | None (they only see your product) |
| **KedgeAgentic account** | Yes | No — represented as a Workspace |

End users never interact with KedgeAgentic directly. They interact with your product, which calls the KedgeAgentic API on their behalf using a Workspace-scoped API key.

---

## Session

A **Session** is a single conversation between an end user and an Agent. Within one Workspace, an end user can have multiple sessions over time — for example, one session per project or one per day.

Sessions carry:
- The full conversation history (messages, Agent responses, tool calls)
- The active Skill context
- References to files generated or uploaded during that session

Sessions are persisted and can be resumed after disconnection.

---

## Skill

A **Skill** defines how the Agent behaves in a specific context — its persona, instructions, available tools, and routing triggers. When an end user sends a message, the Skill Router matches it to the appropriate Skill and the Agent executes within that Skill's context.

See [Skill Writing Guide](../guide/skill-writing.md) for details.

---

## MCP Server

An **MCP Server** exposes tools that the Agent can call during execution — database lookups, API calls, file operations, calculations, and more. MCP Servers are registered in `solution.json` and become available to all Skills in the solution.

See [MCP Server Development](../guide/mcp-server.md) for details.

---

## How These Concepts Relate

```
Platform (your KedgeAgentic account)
└── Solution (your Agentic service, defined by solution.json)
    ├── Skills (Agent behavior definitions)
    ├── MCP Servers (tools the Agent can use)
    └── Workspaces (one per end user)
        └── Sessions (one per conversation)
            └── Messages, Files, Tool calls
```

A Solution defines the intelligence (Skills + MCP). A Workspace is the container for one end user's data. A Session is one conversation within that container.

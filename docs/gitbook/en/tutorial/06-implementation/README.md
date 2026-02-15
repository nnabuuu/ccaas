# 6. Implementation Walkthrough

In Chapters 1-5, you designed the Task Manager Solution: the domain model, user journeys, data flow, and form protocol. Now it is time to build it.

## What You Will Build

This chapter walks you through implementing the complete Task Manager Solution step by step. Each sub-chapter produces a working, testable checkpoint so you always have confidence that your code is correct before moving forward.

```
┌──────────────────────────────────────────────────────────┐
│                  Implementation Roadmap                   │
│                                                          │
│  6.1 Setup ──► 6.2 Backend ──► 6.3 MCP ──► 6.4 Skills   │
│                                                          │
│  6.5 Frontend ──► 6.6 Testing                            │
│                                                          │
│  Each step produces a working, testable checkpoint.      │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | NestJS + better-sqlite3 | REST API, data persistence |
| Frontend | React 18 + Vite + Tailwind CSS | User interface |
| MCP Server | Node.js + @modelcontextprotocol/sdk | AI tool service |
| Skills | Markdown (SKILL.md) | AI behavior definitions |
| Chat Integration | @ccaas/react-sdk + Socket.io | Real-time AI communication |

## Chapter Overview

| Sub-Chapter | What You Build | Checkpoint |
|-------------|---------------|------------|
| [6.1 Project Setup](01-setup.md) | Directory structure, solution.json, setup.sh | `setup.sh` runs and all services start |
| [6.2 Backend Implementation](02-backend.md) | NestJS REST API with tasks and projects | `curl POST /api/tasks` returns 201 |
| [6.3 MCP Server](03-mcp-server.md) | write\_output tool and custom tools | MCP Server starts and responds to tool calls |
| [6.4 Skills](04-skills.md) | Task Creator and Bulk Import SKILL.md files | Skills trigger on correct keywords |
| [6.5 Frontend](05-frontend.md) | React UI with chat panel and form sync | Form updates from AI output\_update events |
| [6.6 Testing](06-testing.md) | Unit and integration tests | All tests pass |

## Prerequisites

Before starting, ensure you have:

- Completed Chapters 1-5 (or at minimum read Chapter 1 for architecture context)
- LoopAI platform running locally (`npm run dev:backend` on port 3001)
- Node.js 18+ and npm installed
- A code editor with TypeScript support

## How to Follow Along

1. **Build incrementally.** Each sub-chapter builds on the previous one.
2. **Run the checkpoint** at the end of each sub-chapter before moving on.
3. **Compare with the reference** at `solutions/task-manager-tutorial/` if you get stuck.

Let us begin with [6.1 Project Setup](01-setup.md).

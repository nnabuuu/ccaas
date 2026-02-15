# Solution Builder Tutorial

Welcome to the LoopAI Solution Builder Tutorial. This is a hands-on, end-to-end guide that walks you through building a complete **Lesson Plan Designer** Solution on the LoopAI platform -- from understanding the architecture to deploying to production.

## What You Will Build

By the end of this tutorial, you will have a fully functional Lesson Plan Designer application where:

- Teachers select textbooks and chapters through a web form
- An AI Agent assists with lesson plan creation, generating teaching objectives, activities, and assessments
- The AI writes structured data directly into the form via the `output_update` protocol
- Teachers review, edit, and approve AI-generated lesson plans before saving
- Lesson plans are persisted and can be resumed across sessions

```
┌──────────────────────────────────────────────┐
│          Lesson Plan Designer Solution        │
│                                              │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐ │
│  │ Frontend │◄──►│ Solution │◄──►│  CCAAS  │ │
│  │  (React) │    │ Backend  │    │ Backend │ │
│  └─────────┘    └──────────┘    └────┬────┘ │
│                                      │      │
│                                 ┌────▼────┐ │
│                                 │AI Agent │ │
│                                 │+ Skills │ │
│                                 │+ MCP    │ │
│                                 └─────────┘ │
└──────────────────────────────────────────────┘
```

## Prerequisites

Before starting this tutorial, you should have:

- **Node.js 18+** and **npm** installed
- Basic knowledge of **TypeScript** and **React**
- Familiarity with REST APIs and WebSocket concepts
- A working LoopAI installation (see [Installation](../getting-started/installation.md))

{% hint style="info" %}
**No LoopAI experience required.** This tutorial assumes you have never used the platform before. Every concept is introduced with clear explanations before diving into code.
{% endhint %}

## Tutorial Structure

The tutorial is organized into 7 chapters that follow a natural progression from design to deployment:

### Phase 1: Design (Chapters 1-3)

Before writing any code, we design the solution. This phase teaches you the thinking process behind every LoopAI Solution.

| Chapter | What You Learn | Key Deliverable |
|---------|---------------|-----------------|
| [1. Understanding Solution Architecture](01-architecture.md) | How Solutions fit into the LoopAI platform | Mental model of the architecture |
| [2. Designing the Domain Model](02-domain-model.md) | How to model your business entities | TypeScript interfaces for LessonPlan, TextbookChapter |
| [3. Mapping User Journeys](03-user-journeys.md) | How to identify AI collaboration points | User flow diagrams with AI touchpoints |

### Phase 2: Protocols (Chapters 4-5)

With the design in hand, we learn how data moves through the system and how AI output reaches the user's form.

| Chapter | What You Learn | Key Deliverable |
|---------|---------------|-----------------|
| [4. Data Flow and State Management](04-data-flow.md) | How messages flow through WebSocket events | Data flow diagram for Lesson Plan Designer |
| [5. Forms and output\_update Protocol](05-form-protocol.md) | How AI writes structured data to forms | SyncField definitions and write\_output spec |

### Phase 3: Implementation (Chapter 6)

Now we build. Each sub-chapter produces a working, testable checkpoint.

| Chapter | What You Build | Checkpoint |
|---------|---------------|------------|
| [6.1 Project Setup](06-implementation/01-setup.md) | Directory structure, solution.json | `setup.sh` runs successfully |
| [6.2 Backend Implementation](06-implementation/02-backend.md) | REST API for lesson plans and textbooks | `curl POST /api/lesson-plans` returns 201 |
| [6.3 MCP Server](06-implementation/03-mcp-server.md) | write\_output tool and custom tools | MCP Server starts and responds |
| [6.4 Skills](06-implementation/04-skills.md) | Lesson Plan Designer skill | Skill triggers match correctly |
| [6.5 Frontend](06-implementation/05-frontend.md) | React UI with form sync | Form updates from AI output |
| [6.6 Testing](06-implementation/06-testing.md) | Unit and integration tests | All tests pass |

### Phase 4: Production (Chapter 7)

Finally, we prepare the solution for real-world use.

| Chapter | What You Learn | Key Deliverable |
|---------|---------------|-----------------|
| [7. Deployment](07-deployment.md) | Environment config, monitoring, scaling | Production-ready deployment checklist |

## How to Use This Tutorial

### Recommended Approach

1. **Read chapters in order.** Each chapter builds on the previous one.
2. **Type the code yourself.** Avoid copy-pasting -- typing helps you internalize the patterns.
3. **Run the checkpoints.** Every section ends with a verification step. Do not proceed until the checkpoint passes.
4. **Try the exercises.** Each chapter includes exercises to deepen your understanding.

### Reference Solution

The canonical reference implementation is the **Lesson Plan Designer** itself:

```
solutions/lesson-plan-designer/
```

This is a production-grade Solution that demonstrates every pattern taught in this tutorial. Use it to compare your work or to get unstuck. But try to build it yourself first.

{% hint style="warning" %}
**Do not skip the design chapters** (1-3). They may seem abstract, but the patterns you learn there directly inform every implementation decision in Chapter 6. Developers who skip design often have to rewrite their code later.
{% endhint %}

## Key Concepts at a Glance

Here are the core concepts you will learn throughout this tutorial:

| Concept | Description | Where Introduced |
|---------|-------------|-----------------|
| **Solution** | A vertical application built on LoopAI | Chapter 1 |
| **Domain Model** | TypeScript interfaces representing your business entities | Chapter 2 |
| **User Journey** | A sequence of interactions that achieves a user goal | Chapter 3 |
| **Relay Architecture** | CCAAS acts as a relay between frontend and AI Agent | Chapter 4 |
| **output\_update** | The protocol for syncing AI output to frontend forms | Chapter 5 |
| **SyncField** | A form field that can receive AI-generated data | Chapter 5 |
| **write\_output** | The MCP tool that AI calls to write structured data | Chapter 5 |
| **Skill** | A Markdown file that defines AI Agent behavior | Chapter 6.4 |
| **MCP Server** | A service providing tools callable by AI Agents | Chapter 6.3 |

## Time Commitment

| Phase | Chapters | Suggested Pace |
|-------|----------|---------------|
| Design | 1-3 | One sitting |
| Protocols | 4-5 | One sitting |
| Implementation | 6.1-6.6 | Two to three sittings |
| Production | 7 | One sitting |

## Next Step

Ready to start? Begin with [Chapter 1: Understanding Solution Architecture](01-architecture.md).

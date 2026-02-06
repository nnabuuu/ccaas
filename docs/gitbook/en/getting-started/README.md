# Getting Started

This section helps you set up the LoopAI development environment locally and explore the core features of the platform.

## Prerequisites

- **Node.js** 18.x or later
- **npm** 9.x or later
- **CCAAS Platform** - Either access to a deployed instance or run locally (see [Installation](installation.md))

## Section Overview

| Section | Description | Audience |
|---------|-------------|----------|
| [Installation & Setup](installation.md) | Environment configuration, dependency installation, starting services | All developers |
| [5-Minute Quick Start](quickstart.md) | Core feature demo, basic API interaction | Developers who want a quick overview |

## Project Structure

```
ccaas/
├── package.json                # Workspace root config (npm workspaces)
├── packages/
│   ├── backend/                # @ccaas/backend - NestJS backend service
│   ├── admin/                  # @ccaas/admin - Vue 3 admin dashboard
│   ├── vue-sdk/                # @ccaas/vue-sdk - Vue frontend SDK
│   └── shared/                 # @ccaas/common - Shared types and protocols
├── solutions/                  # Solution example projects
│   ├── ccaas-demo/             # Basic demo
│   ├── lesson-plan-designer/   # Lesson Plan Designer
│   └── problem-explainer/      # Problem Explainer
└── docs/                       # Documentation
```

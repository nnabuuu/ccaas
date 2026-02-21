# Installation & Setup

This guide shows you how to run CCAAS platform locally for **Solution development**.

{% hint style="info" %}
**For Solution Developers**: This setup runs the full CCAAS platform on your local machine. The platform comes with built-in AI capabilities - you don't need to install or configure any AI engines separately.
{% endhint %}

{% hint style="warning" %}
**For Production Deployment**: If you're deploying CCAAS to production servers, you'll need to configure the AI engine backend. Contact your platform administrator for deployment documentation.
{% endhint %}

## 1. Clone the Repository

```bash
git clone <repository-url>
cd ccaas
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Build the Shared Package

The shared package (`@kedge-agentic/common`) must be built first, as other packages depend on its type definitions:

```bash
npm run build:common
```

## 4. Start the Backend Service

```bash
npm run dev:backend
```

The backend service will be available at `http://localhost:3001`.

## 5. Start the Admin Dashboard (Optional)

```bash
npm run dev:admin
```

The admin dashboard will be available at `http://localhost:5174`.

## Using SDK in a Solution (without cloning the monorepo)

If you're developing a Solution **outside** the monorepo, install the published SDK packages directly from npm:

```bash
# Install React SDK (includes common as a dependency)
npm install @kedge-agentic/react-sdk@0.1.0

# Or install shared types only
npm install @kedge-agentic/common@0.1.0
```

## Building All Packages

To build all packages, run them in the correct dependency order:

```bash
npm run build:common    # 1. Shared types (must be first)
npm run build:backend   # 2. Backend service
npm run build:admin     # 3. Admin dashboard
npm run build:vue-sdk   # 4. Vue SDK
npm run build:react-sdk # 5. React SDK
```

Or build everything at once:

```bash
npm run build
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests for a specific package
npm run test -w @kedge-agentic/backend
npm run test -w @kedge-agentic/vue-sdk
npm run test -w @kedge-agentic/common
```

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 3001 | NestJS backend service |
| Admin UI | 5174 | Vue admin dashboard |
| Solution Backend | 3002-3003 | Solution business backend |
| MCP Server | 3004+ | MCP tool service |
| Solution Frontend | 5279-5281 | Solution frontend |

## Environment Variables

The backend service supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Service listening port |
| `NODE_ENV` | development | Runtime environment |
| `DATABASE_PATH` | ./data/ccaas.db | SQLite database path |
| `WORKSPACE_DIR` | .agent-workspace | AI Agent workspace directory |
| `AUTH_ALLOW_ANONYMOUS` | true | Allow anonymous access |
| `AUTH_ENABLE_RATE_LIMITING` | false | Enable rate limiting |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | 30000 | MCP health check interval |

## Starting a Solution Example

Each Solution provides a one-click setup script:

```bash
# CCAAS Demo
cd solutions/ccaas-demo
./setup.sh

# Lesson Plan Designer
cd solutions/lesson-plan-designer
./setup.sh

# Problem Explainer
cd solutions/problem-explainer
./setup.sh
```

{% hint style="info" %}
Before starting a Solution, make sure the CCAAS backend service is already running on port 3001.
{% endhint %}

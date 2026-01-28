# Installation & Setup

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

The shared package (`@ccaas/shared`) must be built first, as other packages depend on its type definitions:

```bash
npm run build:shared
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

## Building All Packages

To build all packages, run them in the correct dependency order:

```bash
npm run build:shared    # 1. Shared types (must be first)
npm run build:backend   # 2. Backend service
npm run build:admin     # 3. Admin dashboard
npm run build:vue-sdk   # 4. Vue SDK
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
npm run test -w @ccaas/backend
npm run test -w @ccaas/vue-sdk
npm run test -w @ccaas/shared
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

# Claude Code Admin Dashboard

Admin management UI for Claude Code as a Service platform.

## Features

- **Dashboard**: Overview metrics, active sessions, token usage, error rates
- **Session Management**: View sessions, timeline of events, kill active processes
- **Skill Management**: CRUD, version history, rollback, publish workflow
- **Analytics**: Token usage charts, cost breakdown by tenant/model
- **Tenant Management**: Multi-tenant organization management, API keys
- **Audit Log**: Track all admin actions for compliance

## Tech Stack

- **Vue 3** with Composition API
- **TypeScript** with strict mode
- **Ant Design Vue 4.x** - UI components
- **ECharts 5.x** - Analytics charts
- **Pinia** - State management
- **Vue Router** - Navigation
- **Axios** - API client

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## Development

The admin dashboard runs on port 5174 and proxies API requests to the backend at `localhost:3001`.

### Authentication

Login with an API key that has the `admin` scope. The API key is stored in localStorage.

### Project Structure

```
src/
├── api/            # API client
├── components/     # Reusable components
│   └── layout/     # Layout components
├── router/         # Vue Router configuration
├── stores/         # Pinia stores
├── styles/         # Global styles
├── types/          # TypeScript types
└── views/          # Page components
    ├── analytics/  # Analytics pages
    ├── audit/      # Audit log page
    ├── sessions/   # Session management pages
    ├── skills/     # Skill management pages
    └── tenants/    # Tenant management pages
```

## API Endpoints

The admin UI consumes these backend endpoints:

### Dashboard
- `GET /api/v1/admin/dashboard/summary`
- `GET /api/v1/admin/dashboard/recent-sessions`

### Sessions
- `GET /api/v1/admin/sessions`
- `GET /api/v1/admin/sessions/active`
- `GET /api/v1/admin/sessions/:id/timeline`
- `POST /api/v1/admin/sessions/:id/kill`

### Analytics
- `GET /api/v1/admin/analytics/tokens`
- `GET /api/v1/admin/analytics/costs`
- `GET /api/v1/admin/analytics/api-keys`

### Audit
- `GET /api/v1/admin/audit/log`
- `GET /api/v1/admin/audit/recent`

### Skills (Admin Extensions)
- `GET /api/v1/admin/skills/:id/versions`
- `POST /api/v1/admin/skills/:id/rollback/:version`
- `GET /api/v1/admin/skills/:id/diff`

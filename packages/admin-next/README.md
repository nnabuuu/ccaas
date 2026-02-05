# @ccaas/admin-next

Admin dashboard for Claude Code as a Service, built with React, Refine, shadcn/ui, and Tailwind CSS.

## Features

### ✅ Implemented Features

- 📊 **Dashboard** - Real-time metrics and system overview
- 👥 **Sessions** - Active session monitoring and management
- ⚡ **Skills** - Skill CRUD, versioning, and editor
- 🏢 **Tenants** - Multi-tenant management and quotas
- 📝 **Audit Log** - System activity tracking
- 📈 **Analytics** - Usage analytics and insights
- ⏰ **Scheduler** - Scheduled task management

### 🚧 Planned Features

See [ROADMAP.md](./ROADMAP.md) for the complete feature roadmap with 14 tracked issues in Linear.

**Highest Priority (Backend Ready):**
- 🔑 API Key Management - Full CRUD UI ([NIE-44](https://linear.app/niex/issue/NIE-44))
- 💰 Quota Management - Edit Limits & Alerts ([NIE-45](https://linear.app/niex/issue/NIE-45))
- 📜 Skills Version History - Timeline, Diff, Rollback ([NIE-46](https://linear.app/niex/issue/NIE-46))
- 📁 File Browser - Session Workspace Explorer ([NIE-47](https://linear.app/niex/issue/NIE-47))
- 🔌 SDK Connection Inspector ([NIE-48](https://linear.app/niex/issue/NIE-48))

[View Full Roadmap →](./ROADMAP.md) | [Linear Project](https://linear.app/niex/project/ccaas-42d2a7c1ccd9)

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: [Refine](https://refine.dev/) + [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Real-time**: Socket.io client
- **Charts**: Recharts

## Development

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5175`.

### Disable Authentication (Development Only)

To bypass authentication during local development:

1. Create a `.env.local` file (already exists with default config):
   ```env
   VITE_DISABLE_AUTH=true
   ```

2. Restart the dev server
3. You'll be automatically logged in as "Dev Admin (No Auth)"

**⚠️ WARNING**: Do NOT use this in production. The `.env.local` file is already gitignored.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DISABLE_AUTH` | `false` | Disable authentication (dev only) |

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── layout/         # Layout components (AppLayout, Sidebar)
│   ├── shared/         # Shared components (StatusBadge, etc.)
│   └── ui/             # shadcn/ui components
├── lib/                # Utilities and configurations
│   ├── api-client.ts   # Axios client with auth interceptor
│   └── utils.ts        # Helper functions
├── pages/              # Page components (routes)
│   ├── dashboard/      # Dashboard page
│   ├── sessions/       # Sessions list & detail
│   ├── skills/         # Skills list & editor
│   ├── tenants/        # Tenants list & detail
│   ├── audit/          # Audit log
│   ├── analytics/      # Analytics
│   └── scheduler/      # Scheduled tasks
├── providers/          # Refine providers
│   ├── auth-provider.ts      # Production auth provider
│   ├── auth-provider.dev.ts  # Development auth bypass
│   ├── data-provider.ts      # Data provider
│   └── live-provider.ts      # Real-time updates
├── App.tsx             # App entry point
└── main.tsx            # Vite entry point
```

## Authentication

The admin dashboard uses API key authentication:

1. Enter your admin API key on the login page
2. The key is stored in localStorage as `admin_api_key`
3. All API requests include the key in the `x-api-key` header

For development, you can bypass authentication by setting `VITE_DISABLE_AUTH=true` in `.env.local`.

## API Proxy

The dev server proxies API requests to the backend:

- `/api` → `http://localhost:3001`
- `/socket.io` → `http://localhost:3001` (WebSocket)

Configure the backend URL in `vite.config.ts` if needed.

## Component Library

This project uses [shadcn/ui](https://ui.shadcn.com/) components. To add new components:

```bash
npx shadcn@latest add <component-name>
```

## Related Packages

- `@ccaas/backend` - NestJS API server
- `@ccaas/shared` - Shared types and schemas
- `@ccaas/react-sdk` - React SDK for client integration

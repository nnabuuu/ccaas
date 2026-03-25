# CLAUDE.md - @kedge-agentic/admin-next

Admin dashboard for the KedgeAgentic platform.

## Tech Stack

- **React 18** + TypeScript
- **Refine v4** - Data fetching, CRUD, auth, routing
- **shadcn/ui** + Radix UI - Component library
- **Tailwind CSS** - Styling
- **Zustand** - State management (tenant context)
- **Vite** - Build tool
- **Vitest** + Testing Library - Tests

## Directory Structure

```
src/
├── components/
│   ├── layout/          # AppLayout, Header, Sidebar, CommandPalette
│   ├── shared/          # DataTable, StatusBadge, StatCard, ChartCard, DateRangePicker
│   ├── tenants/         # Tenant CRUD modals (edit, quota, config, bundles, api-keys)
│   ├── workspace/       # FileTree, WorkspaceExplorer, FileViewer
│   ├── scheduler/       # ExecutionDetailModal
│   └── ui/              # shadcn/ui primitives (button, dialog, input, etc.)
├── contexts/            # LanguageContext (i18n)
├── hooks/               # useAdminSocket, useFileDownload, useWorkspaceFiles, useTheme, useLandingStats
├── lib/                 # apiClient (axios), socket, utils, format, file-utils, api-parser
├── pages/               # Route pages (see Routes below)
├── providers/           # Refine providers (data, auth, notification, live)
├── types/               # TypeScript types (workspace)
└── __tests__/           # Test files
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | LandingPage | Public landing page |
| `/login` | LoginPage | API key authentication |
| `/dashboard` | DashboardPage | Overview metrics |
| `/sessions` | SessionListPage | Session list with filters |
| `/sessions/:sessionId` | SessionDetailPage | Session detail with turns/queue |
| `/skills` | SkillListPage | Skill registry |
| `/skills/:idOrSlug` | SkillEditorPage | Skill YAML editor |
| `/tenants` | TenantListPage | Tenant management |
| `/tenants/create` | CreateTenantPage | Create tenant |
| `/tenants/:tenantId` | TenantDetailPage | Tenant detail (keys, quotas, config) |
| `/api-keys` | ApiKeysListPage | API key management |
| `/scheduler` | SchedulerListPage | Scheduled tasks |
| `/scheduler/:id` | SchedulerDetailPage | Task execution history |
| `/analytics` | AnalyticsPage | Token/cost analytics |
| `/analytics/skills` | SkillAnalyticsPage | Per-skill analytics |
| `/session-templates` | SessionTemplatesListPage | Session template list |
| `/session-templates/create` | SessionTemplateFormPage | Create/edit template |
| `/audit` | AuditLogPage | Audit log viewer |
| `/queue` | QueueMonitorPage | Queue monitor |

## Authentication

- API key stored in localStorage (`admin_api_key`)
- Validated against `/admin/dashboard/summary`
- Two scopes: **admin** (full access) and **builder** (limited to tenants + api-keys)
- Builder users route to `/builder/tenants` endpoint

## Refine Providers

| Provider | File | Purpose |
|----------|------|---------|
| `dataProvider` | `providers/data-provider.ts` | Maps resources to backend API endpoints |
| `authProvider` | `providers/auth-provider.ts` | API key login, logout, identity |
| `notificationProvider` | `providers/notification-provider.ts` | Toast notifications (sonner) |
| `liveProvider` | `providers/live-provider.ts` | Real-time updates via Socket.IO |

## API Client

- `lib/api-client.ts` - Axios instance with API key interceptor
- Base URL from `VITE_API_BASE_URL` env var (default: `http://localhost:3001/api/v1`)
- All admin endpoints prefixed with `/admin/`

## Adding a New Page

1. Create page component in `src/pages/<resource>/`
2. Add lazy import in `App.tsx`
3. Add Refine resource in `App.tsx` resources array
4. Add `<Route>` inside the authenticated layout
5. Add sidebar entry in `components/layout/sidebar.tsx`

## Adding a New Resource to Data Provider

1. Add resource URL mapping in `data-provider.ts` `getResourceUrl()`
2. Handle special response formats in `getList`/`getOne` if needed
3. For tenant-scoped resources, use `meta.tenantId`

## Dev Commands

```bash
npm run dev              # Start on :5175
npm run build            # TypeScript check + Vite build
npm run test             # Vitest
npm run lint             # ESLint
```

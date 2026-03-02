# Admin Panel Roadmap

**Last Updated:** 2026-02-05
**Linear Project:** [CCAAS](https://linear.app/niex/project/ccaas-42d2a7c1ccd9)

## Overview

This roadmap tracks the development of admin panel features for the CCAAS platform. All features are tracked in Linear issues NIE-44 through NIE-57.

## Current Status

- **Total Pages Implemented:** 13
- **Fully Working Features:** 10 major areas
- **Backend-Ready Features:** 11 (highest priority)
- **Features Needing Backend:** 3 (lower priority)

## Technology Stack

- React 18 + TypeScript
- Refine framework (data management)
- shadcn/ui + Tailwind CSS
- SSE (real-time updates)
- Recharts (visualizations)
- Backend: NestJS with 18 controllers, 24 entity types

## Feature Status

### ✅ Complete & Working

These features are fully implemented and functional:

1. **Dashboard** - Overview metrics, charts, and statistics
2. **Sessions List & Detail** - View all sessions, session details
3. **Skills List & Detail** - Manage skills with basic CRUD
4. **Tenants List & Detail** - View tenant information and quotas
5. **Audit Log** - View audit trail (basic filtering)
6. **Analytics** - Token usage, session analytics
7. **Scheduled Tasks List & Detail** - View scheduled tasks and executions
8. **Basic Authentication** - Login/logout functionality
9. **Real-time Updates** - WebSocket connection for some features
10. **SDK Distribution** - Pie chart showing SDK types

### 🚧 TIER 1: Critical Priority (Backend Ready)

These features have complete backend support but missing/incomplete frontend UI. **Highest ROI for implementation.**

| Issue | Feature | Effort | Status |
|-------|---------|--------|--------|
| [NIE-44](https://linear.app/niex/issue/NIE-44) | **API Key Management** - Full CRUD UI | Large (4-5d) | 🔴 Not Started |
| [NIE-45](https://linear.app/niex/issue/NIE-45) | **Quota Management** - Edit Limits & Alerts | Medium (2-3d) | 🔴 Not Started |
| [NIE-46](https://linear.app/niex/issue/NIE-46) | **Skills Version History** - Timeline, Diff, Rollback | Large (4-5d) | 🔴 Not Started |
| [NIE-47](https://linear.app/niex/issue/NIE-47) | **File Browser** - Session Workspace Explorer | Large (5-6d) | 🔴 Not Started |
| [NIE-48](https://linear.app/niex/issue/NIE-48) | **SDK Connection Inspector** - Detail View | Medium (2-3d) | 🔴 Not Started |

**TIER 1 Total Effort:** 19-22 days

### 🔧 TIER 2: Medium Priority (Backend Ready)

Enhancement features with complete backend support.

| Issue | Feature | Effort | Status |
|-------|---------|--------|--------|
| [NIE-49](https://linear.app/niex/issue/NIE-49) | **Scheduler Task Creation** - Form with Cron Builder | Medium (3-4d) | 🔴 Not Started |
| [NIE-50](https://linear.app/niex/issue/NIE-50) | **Scheduler Task Editing** - Pause/Resume/Delete | Medium (2-3d) | 🔴 Not Started |
| [NIE-51](https://linear.app/niex/issue/NIE-51) | **Execution Log Viewer** - Detail Modal | Small (1-2d) | 🔴 Not Started |
| [NIE-52](https://linear.app/niex/issue/NIE-52) | **Session Advanced Filtering** - Date/Tenant/Status | Small (1-2d) | 🔴 Not Started |
| [NIE-53](https://linear.app/niex/issue/NIE-53) | **Dashboard Real-time Updates** - WebSocket Integration | Medium (2-3d) | 🔴 Not Started |
| [NIE-54](https://linear.app/niex/issue/NIE-54) | **Audit Log Filtering** - Multi-dimensional + CSV Export | Small (1-2d) | 🔴 Not Started |

**TIER 2 Total Effort:** 11-16 days

### 🔮 TIER 3: Low Priority (Needs Backend)

Features requiring backend implementation before frontend work.

| Issue | Feature | Effort | Status |
|-------|---------|--------|--------|
| [NIE-55](https://linear.app/niex/issue/NIE-55) | **Tenant CRUD** - Create & Edit Forms | Medium (2-3d) | ⚠️ Backend TBD |
| [NIE-56](https://linear.app/niex/issue/NIE-56) | **MCP Server Management** - Config & Health | Large (5+d) | ⚠️ Backend TBD |
| [NIE-57](https://linear.app/niex/issue/NIE-57) | **Alert Configuration** - Thresholds & Notifications | Large (5+d) | ⚠️ Backend TBD |

**TIER 3 Total Effort:** 12+ days (after backend implementation)

## Implementation Phases

### Phase 1: Core Management (Sprint 1-2)
**Goal:** Complete critical tenant and content management features

- NIE-44: API Key Management
- NIE-45: Quota Management
- NIE-46: Skills Version History

**Estimated:** 10-13 days
**Milestone:** Core Management Features

### Phase 2: Session & File Tools (Sprint 3-4)
**Goal:** Enhance session debugging and file management

- NIE-47: File Browser
- NIE-52: Session Advanced Filtering
- NIE-51: Execution Log Viewer

**Estimated:** 8-10 days
**Milestone:** Session & File Management

### Phase 3: Real-time & Monitoring (Sprint 5)
**Goal:** Improve live monitoring and observability

- NIE-53: Dashboard Real-time Updates
- NIE-48: SDK Connection Inspector
- NIE-54: Audit Log Filtering

**Estimated:** 6-8 days
**Milestone:** Real-time & Monitoring

### Phase 4: Task Automation (Sprint 6)
**Goal:** Complete scheduled task lifecycle management

- NIE-49: Scheduler Task Creation
- NIE-50: Scheduler Task Editing
- (NIE-51 already in Phase 2)

**Estimated:** 5-7 days
**Milestone:** Task Automation

## Labels & Organization

All issues are tagged with:

- **Priority:** `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- **Area:** `area:backend-ready`, `area:needs-backend`
- **Type:** `type:new-feature`, `type:enhancement`
- **Effort:** `effort:small` (1-2d), `effort:medium` (2-4d), `effort:large` (5+d)

## Development Principles

### TDD Required

All new features must follow test-driven development:

1. Write tests FIRST before implementation
2. Ensure 80%+ test coverage
3. Run tests before AND after code changes
4. Never skip test failures

### Design Standards

- Use Refine framework patterns for data management
- Use shadcn/ui components for UI consistency
- Use Tailwind CSS for styling
- Follow existing page structure and component patterns
- Ensure responsive design (mobile-friendly)

### Code Quality

- TypeScript strict mode
- Proper error handling and loading states
- Optimistic UI updates where appropriate
- Toast notifications for user feedback
- Form validation with helpful error messages

## Dependencies

```
NIE-50 (Scheduler Edit) → NIE-49 (Scheduler Create)
```

All other issues are independent and can be worked on in parallel.

## Backend Endpoints Reference

All backend endpoints are documented in `packages/backend/CLAUDE.md`. Key controllers:

- **Admin Tenants:** `/api/v1/admin/tenants`
- **Admin Skills:** `/api/v1/admin/skills`
- **Admin Sessions:** `/api/v1/admin/sessions`
- **Auth (API Keys):** `/api/v1/auth/api-keys`
- **Scheduler:** `/api/v1/scheduled-tasks`
- **Files:** `/api/v1/files`
- **SDK Connections:** `/api/v1/admin/sdk-connections`
- **Audit:** `/api/v1/admin/audit/log`

## Resources

- **Linear Project:** https://linear.app/niex/project/ccaas-42d2a7c1ccd9
- **Backend Docs:** `packages/backend/CLAUDE.md`
- **Admin UI Docs:** `packages/admin-next/README.md`
- **FileExplorer Reference:** `solutions/ccaas-demo/src/components/FileExplorer/`

## Quick Links

- [All CCAAS Issues](https://linear.app/niex/project/ccaas-42d2a7c1ccd9)
- [Critical Priority Issues](https://linear.app/niex/team/NIE/all?label=priority%3Acritical)
- [Backend-Ready Issues](https://linear.app/niex/team/NIE/all?label=area%3Abackend-ready)

---

**Total Tracked Features:** 14 issues
**Total Estimated Effort:** 30-41 days (TIER 1 + TIER 2)
**Next Action:** Start with NIE-44 (API Key Management)

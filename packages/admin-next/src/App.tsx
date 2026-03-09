import { lazy, Suspense } from 'react'
import { Refine, Authenticated } from '@refinedev/core'
import routerProvider, { NavigateToResource, CatchAllNavigate } from '@refinedev/react-router-v6'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { dataProvider } from '@/providers/data-provider'
import { authProvider } from '@/providers/auth-provider'
import { devAuthProvider } from '@/providers/auth-provider.dev'
import { liveProvider } from '@/providers/live-provider'
import { AppLayout } from '@/components/layout/app-layout'
import { Toaster } from 'sonner'

// Use dev auth provider if VITE_DISABLE_AUTH or VITE_DEV_API_KEY is set
const shouldUseDevAuth =
  import.meta.env.VITE_DISABLE_AUTH === 'true' ||
  !!import.meta.env.VITE_DEV_API_KEY
const activeAuthProvider = shouldUseDevAuth ? devAuthProvider : authProvider

// Lazy-loaded pages
const LandingPage = lazy(() => import('@/pages/landing').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const SessionListPage = lazy(() => import('@/pages/sessions/list').then((m) => ({ default: m.SessionListPage })))
const SessionDetailPage = lazy(() => import('@/pages/sessions/detail').then((m) => ({ default: m.SessionDetailPage })))
const SkillListPage = lazy(() => import('@/pages/skills/list').then((m) => ({ default: m.SkillListPage })))
const SkillEditorPage = lazy(() => import('@/pages/skills/editor').then((m) => ({ default: m.SkillEditorPage })))
const TenantListPage = lazy(() => import('@/pages/tenants/list').then((m) => ({ default: m.TenantListPage })))
const TenantDetailPage = lazy(() => import('@/pages/tenants/detail').then((m) => ({ default: m.TenantDetailPage })))
const CreateTenantPage = lazy(() => import('@/pages/tenants/create').then((m) => ({ default: m.CreateTenantPage })))
const AuditLogPage = lazy(() => import('@/pages/audit').then((m) => ({ default: m.AuditLogPage })))
const AnalyticsPage = lazy(() => import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })))
const SchedulerListPage = lazy(() => import('@/pages/scheduler/list').then((m) => ({ default: m.SchedulerListPage })))
const SchedulerDetailPage = lazy(() => import('@/pages/scheduler/detail').then((m) => ({ default: m.SchedulerDetailPage })))
const SkillAnalyticsPage = lazy(() => import('@/pages/analytics/skills').then((m) => ({ default: m.SkillAnalyticsPage })))
const ApiKeysListPage = lazy(() => import('@/pages/api-keys/list').then((m) => ({ default: m.ApiKeysListPage })))
const SessionTemplatesListPage = lazy(() => import('@/pages/session-templates/list').then((m) => ({ default: m.SessionTemplatesListPage })))
const SessionTemplateFormPage = lazy(() => import('@/pages/session-templates/form').then((m) => ({ default: m.SessionTemplateFormPage })))
const QueueMonitorPage = lazy(() => import('@/pages/queue').then((m) => ({ default: m.QueueMonitorPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Loading...
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Refine
        routerProvider={routerProvider}
        dataProvider={dataProvider}
        authProvider={activeAuthProvider}
        liveProvider={liveProvider}
        resources={[
          {
            name: 'dashboard',
            list: '/dashboard',
            meta: { label: 'Dashboard' },
          },
          {
            name: 'sessions',
            list: '/sessions',
            show: '/sessions/:sessionId',
            meta: { label: 'Sessions' },
          },
          {
            name: 'tenants',
            list: '/tenants',
            show: '/tenants/:tenantId',
            meta: { label: 'Tenants' },
          },
          {
            name: 'audit',
            list: '/audit',
            meta: { label: 'Audit Log' },
          },
          {
            name: 'analytics',
            list: '/analytics',
            meta: { label: 'Analytics' },
          },
          {
            name: 'scheduler',
            list: '/scheduler',
            show: '/scheduler/:id',
            meta: { label: 'Scheduler' },
          },
          {
            name: 'api-keys',
            list: '/api-keys',
            meta: { label: 'API Keys' },
          },
          {
            name: 'skills',
            list: '/skills',
            show: '/skills/:idOrSlug',
            meta: { label: 'Skills' },
          },
          {
            name: 'session-templates',
            list: '/session-templates',
            create: '/session-templates/create',
            edit: '/session-templates/:name/edit',
            meta: { label: 'Session Templates' },
          },
          {
            name: 'queue',
            list: '/queue',
            meta: { label: 'Queue Monitor' },
          },
        ]}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
          liveMode: 'auto',
        }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />
            <Route
              element={
                <Authenticated key="auth" fallback={<CatchAllNavigate to="/login" />}>
                  <AppLayout />
                </Authenticated>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionListPage />} />
              <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
              <Route path="/skills" element={<SkillListPage />} />
              <Route path="/skills/:idOrSlug" element={<SkillEditorPage />} />
              <Route path="/tenants" element={<TenantListPage />} />
              <Route path="/tenants/create" element={<CreateTenantPage />} />
              <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/analytics/skills" element={<SkillAnalyticsPage />} />
              <Route path="/scheduler" element={<SchedulerListPage />} />
              <Route path="/scheduler/:id" element={<SchedulerDetailPage />} />
              <Route path="/api-keys" element={<ApiKeysListPage />} />
              <Route path="/session-templates" element={<SessionTemplatesListPage />} />
              <Route path="/session-templates/create" element={<SessionTemplateFormPage />} />
              <Route path="/session-templates/:name/edit" element={<SessionTemplateFormPage />} />
              <Route path="/queue" element={<QueueMonitorPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Suspense>
      </Refine>
      <Toaster />
    </BrowserRouter>
  )
}

export default App

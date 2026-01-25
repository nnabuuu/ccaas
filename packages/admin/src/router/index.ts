import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/layout/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue')
      },
      {
        path: 'sessions',
        name: 'Sessions',
        component: () => import('@/views/sessions/SessionListView.vue')
      },
      {
        path: 'sessions/active',
        name: 'ActiveSessions',
        component: () => import('@/views/sessions/ActiveSessionsView.vue')
      },
      {
        path: 'sessions/:sessionId',
        name: 'SessionDetail',
        component: () => import('@/views/sessions/SessionDetailView.vue'),
        props: true
      },
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/skills/SkillListView.vue')
      },
      {
        path: 'skills/:idOrSlug',
        name: 'SkillDetail',
        component: () => import('@/views/skills/SkillEditorView.vue'),
        props: true
      },
      {
        path: 'analytics',
        name: 'Analytics',
        redirect: '/analytics/usage'
      },
      {
        path: 'analytics/usage',
        name: 'TokenUsage',
        component: () => import('@/views/analytics/AnalyticsView.vue')
      },
      {
        path: 'analytics/costs',
        name: 'Costs',
        component: () => import('@/views/analytics/CostsView.vue')
      },
      {
        path: 'tenants',
        name: 'Tenants',
        component: () => import('@/views/tenants/TenantListView.vue')
      },
      {
        path: 'tenants/:tenantId',
        name: 'TenantDetail',
        component: () => import('@/views/tenants/TenantDetailView.vue'),
        props: true
      },
      {
        path: 'audit',
        name: 'Audit',
        component: () => import('@/views/audit/AuditLogView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory('/admin'),
  routes
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)

  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router

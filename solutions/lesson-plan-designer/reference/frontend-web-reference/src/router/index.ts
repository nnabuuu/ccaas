import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Extend route meta types
declare module 'vue-router' {
  interface RouteMeta {
    layout?: 'default' | 'blank'
    public?: boolean
    fullWidth?: boolean
  }
}

// Routes configuration
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'blank', public: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { layout: 'default' }
  },
  {
    path: '/lesson-plan',
    name: 'LessonPlan',
    component: () => import('../views/LessonPlanView.vue'),
    meta: { layout: 'default' }
  },
  {
    path: '/lesson-plan/new',
    name: 'LessonPlanNew',
    component: () => import('../views/LessonPlanNewView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/lesson-plan/create',
    redirect: '/lesson-plan/new'
  },
  {
    path: '/lesson-plan/:id',
    name: 'LessonPlanDetail',
    component: () => import('../views/LessonPlanDetailView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/course',
    name: 'Course',
    component: () => import('../views/CourseView.vue'),
    meta: { layout: 'default' }
  },
  {
    path: '/course/new',
    name: 'CourseNew',
    component: () => import('../views/CourseNewView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/course/create',
    redirect: '/course/new'
  },
  {
    path: '/course/:id',
    name: 'CourseDetail',
    component: () => import('../views/CourseDetailView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  // Unified Question Bank Module with nested routes
  {
    path: '/question-bank',
    component: () => import('../components/QuestionBankLayout.vue'),
    meta: { layout: 'default', fullWidth: true },
    children: [
      {
        path: '',
        redirect: '/question-bank/browse'
      },
      {
        path: 'browse',
        name: 'QuestionBankBrowse',
        component: () => import('../views/QuestionBankBrowseView.vue')
      },
      {
        path: 'my',
        name: 'QuestionBankMy',
        component: () => import('../views/QuestionBankMyView.vue')
      },
      {
        path: 'review',
        name: 'QuestionBankReview',
        component: () => import('../views/QuestionBankReviewView.vue')
      }
    ]
  },
  // Legacy route redirect (deprecated)
  {
    path: '/learning-tasks',
    redirect: '/question-bank/browse'
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { layout: 'default' }
  },
  {
    path: '/activity/new',
    name: 'ActivityNew',
    component: () => import('../views/ActivityNewView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/activity/:id',
    name: 'ActivityDetail',
    component: () => import('../views/ActivityDetailView.vue'),
    meta: { layout: 'default' } // Keeping detail view default/centered usually better unless complex
  },
  {
    path: '/project/new',
    name: 'ProjectNew',
    component: () => import('../views/ProjectNewView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/project/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { layout: 'default' } // Keeping detail view default/centered

  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { layout: 'default' }
  },
  {
    path: '/ai-assistant',
    name: 'AIAssistant',
    component: () => import('../views/AIAssistantView.vue'),
    meta: { layout: 'default' }
  },
  // Question standalone routes (outside layout wrapper)
  {
    path: '/question/create',
    name: 'QuestionCreate',
    component: () => import('../views/QuestionCreateView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/question/edit/:id',
    name: 'QuestionEdit',
    component: () => import('../views/QuestionEditView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  {
    path: '/question/:id',
    name: 'QuestionDetail',
    component: () => import('../views/QuestionDetailView.vue'),
    meta: { layout: 'default', fullWidth: true }
  },
  // Legacy redirects for old question-bank URLs
  {
    path: '/question-bank/create',
    redirect: '/question/create'
  },
  {
    path: '/question-bank/edit/:id',
    redirect: to => `/question/edit/${to.params.id}`
  },
  {
    path: '/question-bank/:id(\\d+)',
    redirect: to => `/question/${to.params.id}`
  },
  // Legacy route redirects (deprecated)
  {
    path: '/question-bank/my-questions',
    redirect: '/question-bank/my'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  const isPublicRoute = to.meta.public === true

  if (!isPublicRoute && !token) {
    // Redirect to login if not authenticated
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    // Redirect to home if already authenticated
    next({ name: 'Home' })
  } else {
    next()
  }
})

export default router

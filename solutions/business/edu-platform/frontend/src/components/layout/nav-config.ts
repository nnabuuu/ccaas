export interface NavRoute {
  label: string
  path: string | null
  section: 'nav' | 'manage'
  hasBadge?: boolean
}

export const NAV_ROUTES: NavRoute[] = [
  { label: '首页', path: '/', section: 'nav' },
  { label: '教案', path: '/lesson-plans', section: 'nav' },
  { label: '课堂', path: null, section: 'nav' },
  { label: '作业', path: null, section: 'nav', hasBadge: true },
  { label: '学情', path: null, section: 'nav' },
  { label: '资源', path: null, section: 'nav' },
  { label: '管理', path: null, section: 'manage' },
]

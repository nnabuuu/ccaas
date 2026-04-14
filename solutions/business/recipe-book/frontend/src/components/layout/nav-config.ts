export interface NavRoute {
  label: string
  path: string
  section: 'nav'
}

export const NAV_ROUTES: NavRoute[] = [
  { label: '食谱列表', path: '/recipes', section: 'nav' },
  { label: 'AI 对话', path: '/chat', section: 'nav' },
]

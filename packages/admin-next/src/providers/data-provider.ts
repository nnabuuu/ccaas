import type { DataProvider } from '@refinedev/core'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    // Special handling for session-templates
    if (resource === 'session-templates') {
      const tenantId = (meta?.tenantId as string) || 'default'
      const { data } = await apiClient.get(`/admin/tenants/${tenantId}/session-templates`)

      // Transform { templates: {}, defaultTemplate: '' } to array
      const items = Object.entries(data.templates || {}).map(([name, template]) => ({
        name,
        template,
      }))

      return {
        data: items,
        total: items.length,
      }
    }

    const params: Record<string, unknown> = {}

    if (pagination) {
      const { current = 1, pageSize = 10 } = pagination
      params.page = current
      params.limit = pageSize
    }

    if (sorters && sorters.length > 0) {
      params.sortBy = sorters[0].field
      params.sortOrder = sorters[0].order
    }

    if (filters) {
      for (const filter of filters) {
        if ('field' in filter && filter.value !== undefined) {
          params[filter.field] = filter.value
        }
      }
    }

    const url = getResourceUrl(resource)
    const { data } = await apiClient.get(url, { params })

    // Handle both paginated and array responses
    if (Array.isArray(data)) {
      return { data, total: data.length }
    }

    return {
      data: data.data ?? data.items ?? data.sessions ?? data.skills ?? data.tenants ?? data.logs ?? data,
      total: data.total ?? data.pagination?.total ?? 0,
    }
  },

  getOne: async ({ resource, id, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = (meta?.tenantId as string) || 'default'
      const { data } = await apiClient.get(`/admin/tenants/${tenantId}/session-templates/${id}`)
      return { data }
    }

    const url = getResourceUrl(resource)
    const { data } = await apiClient.get(`${url}/${id}`)
    return { data }
  },

  create: async ({ resource, variables, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = (meta?.tenantId as string) || 'default'
      const { data } = await apiClient.post(`/admin/tenants/${tenantId}/session-templates`, variables)
      return { data }
    }

    const url = getResourceUrl(resource)
    const { data } = await apiClient.post(url, variables)
    return { data }
  },

  update: async ({ resource, id, variables, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = (meta?.tenantId as string) || 'default'
      const { data } = await apiClient.put(`/admin/tenants/${tenantId}/session-templates/${id}`, variables)
      return { data }
    }

    const url = getResourceUrl(resource)
    const { data } = await apiClient.put(`${url}/${id}`, variables)
    return { data }
  },

  deleteOne: async ({ resource, id, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = (meta?.tenantId as string) || 'default'
      await apiClient.delete(`/admin/tenants/${tenantId}/session-templates/${id}`)
      return { data: {} }
    }

    const url = getResourceUrl(resource)
    const { data } = await apiClient.delete(`${url}/${id}`)
    return { data }
  },

  getApiUrl: () => '/api/v1',

  custom: async ({ url, method = 'get', payload, query }) => {
    let response
    if (method === 'get') {
      response = await apiClient.get(url, { params: query })
    } else if (method === 'post') {
      response = await apiClient.post(url, payload, { params: query })
    } else if (method === 'put') {
      response = await apiClient.put(url, payload, { params: query })
    } else if (method === 'delete') {
      response = await apiClient.delete(url, { params: query })
    } else {
      response = await apiClient.request({ url, method, data: payload, params: query })
    }
    return { data: response.data }
  },
}

function getResourceUrl(resource: string): string {
  const scope = useTenantContext.getState().callerScope

  // Builder users use dedicated builder endpoints with strict ownership checks
  if (scope === 'builder') {
    const builderMap: Record<string, string> = {
      tenants: '/builder/tenants',
    }
    if (builderMap[resource]) return builderMap[resource]
  }

  const map: Record<string, string> = {
    dashboard: '/admin/dashboard',
    sessions: '/admin/sessions',
    'sessions/active': '/admin/sessions/active',
    skills: '/admin/skills',
    tenants: '/admin/tenants',
    audit: '/admin/audit/log',
    'analytics/tokens': '/admin/analytics/tokens',
    'analytics/costs': '/admin/analytics/costs',
    'analytics/api-keys': '/admin/analytics/api-keys',
    scheduler: '/scheduler/tasks',
    'api-keys': '/admin/api-keys',
  }
  return map[resource] ?? `/admin/${resource}`
}

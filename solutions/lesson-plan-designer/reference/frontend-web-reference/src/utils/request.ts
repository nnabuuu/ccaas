import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '../stores/core/authStore'
import router from '../router'
import type { ApiResponse } from '@/types'

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e'
const DEFAULT_TENANT_ID = import.meta.env.VITE_TENANT_ID || '000000'

// Create axios instance
const request: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

// Request interceptor
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore()

    // Add authorization token
    if (authStore.token) {
      config.headers['Authorization'] = `Bearer ${authStore.token}`
    }

    // Add tenant ID if available
    config.headers['tenant-id'] = authStore.tenantId || DEFAULT_TENANT_ID

    // Add client ID for RuoYi
    config.headers['clientid'] = CLIENT_ID

    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data

    // RuoYi returns code 200 for success
    if (res.code === 200) {
      return res as any
    }

    // Handle error codes
    if (res.code === 401) {
      // Unauthorized - redirect to login
      const authStore = useAuthStore()
      authStore.logout()
      router.push('/login')
      return Promise.reject(new Error(res.msg || '登录已过期，请重新登录'))
    }

    // Other errors
    console.error('API error:', res.msg)
    return Promise.reject(new Error(res.msg || '请求失败'))
  },
  (error) => {
    console.error('Response error:', error)

    // Handle network errors
    if (error.response) {
      const { status } = error.response
      if (status === 401) {
        const authStore = useAuthStore()
        authStore.logout()
        router.push('/login')
      }
    }

    return Promise.reject(error)
  }
)

export default request

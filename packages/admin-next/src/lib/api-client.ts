import axios from 'axios'
import { ADMIN_API_KEY_STORAGE } from '@kedge-agentic/common'

const API_BASE = '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem(ADMIN_API_KEY_STORAGE)
  if (apiKey) {
    config.headers['x-api-key'] = apiKey
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(ADMIN_API_KEY_STORAGE)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

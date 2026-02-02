import axios from 'axios'

const API_BASE = '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('admin_api_key')
  if (apiKey) {
    config.headers['x-api-key'] = apiKey
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_api_key')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

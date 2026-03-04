import axios from 'axios'

// Solution backend (NestJS on port 3002)
const SOLUTION_API_URL = import.meta.env.VITE_SOLUTION_API_URL || 'http://localhost:3002'

const solutionRequest = axios.create({
  baseURL: `${SOLUTION_API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
})

// Response interceptor — solution backend returns data directly (no RuoYi wrapper)
solutionRequest.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('Solution API error:', error)
    return Promise.reject(error)
  },
)

export default solutionRequest

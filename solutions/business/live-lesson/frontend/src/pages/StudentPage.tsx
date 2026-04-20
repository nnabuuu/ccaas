import { Navigate } from 'react-router-dom'

/**
 * Legacy student page — redirects to /join.
 * Students should use the /join route with a session code instead.
 */
export default function StudentPage() {
  return <Navigate to="/join" replace />
}

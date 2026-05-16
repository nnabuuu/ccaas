import { Routes, Route, Navigate } from 'react-router-dom'
import ProjectListPage from './pages/ProjectListPage'
import ProjectEditorPage from './pages/ProjectEditorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/:id" element={<ProjectEditorPage />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

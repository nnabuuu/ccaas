import { Routes, Route, Navigate } from 'react-router-dom'
import ProjectListPage from './pages/ProjectListPage'
import ProjectEditorPage from './pages/ProjectEditorPage'
import CardsPreviewPage from './pages/CardsPreviewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/:id" element={<ProjectEditorPage />} />
      {/* Dev-only route for the rich-chat-cards visual sandbox.
          Gated on import.meta.env.DEV — Vite strips this from prod
          bundles (the JSX tree is unreachable + tree-shaken). */}
      {import.meta.env.DEV && (
        <Route path="/dev/cards-preview" element={<CardsPreviewPage />} />
      )}
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { TopNav } from './components/layout/TopNav'
import { RecipeListPage } from './pages/RecipeListPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { ChatPage } from './pages/ChatPage'

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="main-content">
        {children}
      </div>
      <style>{`
        .main-content {
          margin-left: 0;
          padding: 32px 24px 80px;
          background: var(--bg);
          min-height: 100vh;
        }
        @media (min-width: 1200px) {
          .main-content {
            margin-left: var(--sidebar-w);
            padding: 32px 48px 80px;
          }
        }
      `}</style>
    </>
  )
}

function App() {
  return (
    <>
      <Sidebar />
      <TopNav />
      <Routes>
        <Route path="/" element={<Navigate to="/recipes" replace />} />
        <Route path="/recipes" element={<PageWrapper><RecipeListPage /></PageWrapper>} />
        <Route path="/recipes/:id" element={<PageWrapper><RecipeDetailPage /></PageWrapper>} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </>
  )
}

export default App

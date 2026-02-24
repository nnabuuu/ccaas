import { Routes, Route, useLocation } from 'react-router-dom'
import CourseSelectionPage from './pages/CourseSelectionPage'
import LessonPage from './pages/LessonPage'

// Wrapper forces LessonPage to fully remount on every navigation (new location.key),
// so useAgentConnection re-reads localStorage and forceNew is always honored.
function LessonPageWrapper() {
  const location = useLocation()
  return <LessonPage key={location.key} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<CourseSelectionPage />} />
      <Route path="/lesson/:lessonId" element={<LessonPageWrapper />} />
    </Routes>
  )
}

export default App

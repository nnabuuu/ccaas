import { Routes, Route, useLocation } from 'react-router-dom'
import CourseSelectionPage from './pages/CourseSelectionPage'
import LessonPage from './pages/LessonPage'
import BoardPage from './pages/BoardPage'
import StudentPage from './pages/StudentPage'
import TeacherPage from './pages/TeacherPage'
import DemoPage from './pages/DemoPage'
import JoinPage from './pages/JoinPage'

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
      <Route path="/board/:lessonId" element={<BoardPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/student/:lessonId" element={<StudentPage />} />
      <Route path="/teacher/:lessonId" element={<TeacherPage />} />
      <Route path="/demo/:lessonId" element={<DemoPage />} />
    </Routes>
  )
}

export default App

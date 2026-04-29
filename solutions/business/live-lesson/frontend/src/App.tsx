import { Routes, Route } from 'react-router-dom'
import CourseSelectionPage from './pages/CourseSelectionPage'
import BoardPage from './pages/BoardPage'
import TeacherPage from './pages/TeacherPage'
import DemoPage from './pages/DemoPage'
import JoinPage from './pages/JoinPage'
import SessionPage from './pages/SessionPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CourseSelectionPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
      <Route path="/session/:sessionId/watch" element={<TeacherPage />} />
      <Route path="/session/:sessionId/demo" element={<DemoPage />} />
      <Route path="/board/:lessonId" element={<BoardPage />} />
    </Routes>
  )
}

export default App

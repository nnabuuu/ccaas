import { Routes, Route } from 'react-router-dom'
import CourseSelectionPage from './pages/CourseSelectionPage'
import TeacherPage from './pages/TeacherPage'
import DemoPage from './pages/DemoPage'
import JoinPage from './pages/JoinPage'
import SessionPage from './pages/SessionPage'
import HowToJoinPage from './pages/HowToJoinPage'
import SessionListPage from './pages/SessionListPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CourseSelectionPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
      <Route path="/session/:sessionId/watch" element={<TeacherPage />} />
      <Route path="/session/:sessionId/demo" element={<DemoPage />} />
      <Route path="/how-to-join" element={<HowToJoinPage />} />
      <Route path="/sessions" element={<SessionListPage />} />
    </Routes>
  )
}

export default App

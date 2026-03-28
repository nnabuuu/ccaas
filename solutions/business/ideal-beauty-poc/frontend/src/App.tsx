import StudentApp from './student/StudentApp';
import TeacherApp from './teacher/TeacherApp';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isTeacher = params.get('role') === 'teacher';

  return isTeacher ? <TeacherApp /> : <StudentApp />;
}

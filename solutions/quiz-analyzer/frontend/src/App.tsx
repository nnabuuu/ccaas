import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import QuizList from './pages/QuizList';
import QuizDetail from './pages/QuizDetail';
import BatchAnalysis from './pages/BatchAnalysis';
import KnowledgePoints from './pages/KnowledgePoints';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/quizzes" replace />} />
          <Route path="quizzes" element={<QuizList />} />
          <Route path="quizzes/:id" element={<QuizDetail />} />
          <Route path="batch" element={<BatchAnalysis />} />
          <Route path="knowledge-points" element={<KnowledgePoints />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

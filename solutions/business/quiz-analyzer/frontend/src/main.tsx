import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import KpMatchPage from './pages/KpMatchPage';
import QuizAnalyzePage from './pages/QuizAnalyzePage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<QuizAnalyzePage />} />
        <Route path="/full-analysis" element={<App />} />
        <Route path="/kp-match" element={<KpMatchPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

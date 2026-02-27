import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import KpMatchPage from './pages/KpMatchPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/quiz-analyzer">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/kp-match" element={<KpMatchPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

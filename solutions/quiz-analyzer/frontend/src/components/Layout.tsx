import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path) ? 'active' : '';
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo">
          <h2>📚 Quiz Analyzer</h2>
          <p className="subtitle">教育题目智能分析系统</p>
        </div>

        <ul className="nav-menu">
          <li>
            <Link to="/quizzes" className={isActive('/quizzes')}>
              <span className="icon">📝</span>
              <span>题目列表</span>
            </Link>
          </li>
          <li>
            <Link to="/batch" className={isActive('/batch')}>
              <span className="icon">⚡</span>
              <span>批量分析</span>
            </Link>
          </li>
          <li>
            <Link to="/knowledge-points" className={isActive('/knowledge-points')}>
              <span className="icon">🌳</span>
              <span>知识点</span>
            </Link>
          </li>
        </ul>

        <div className="sidebar-footer">
          <p className="version">v1.0.0</p>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

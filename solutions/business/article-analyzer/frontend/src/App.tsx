import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import Breadcrumb from './components/ui/Breadcrumb';
import ArticleListPage from './pages/ArticleListPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import RunProgressPage from './pages/RunProgressPage';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

function useRouteBreadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  const items: { label: string; to?: string }[] = [{ label: 'Articles', to: '/' }];
  if (pathname.startsWith('/articles/')) {
    items.push({ label: 'Detail' });
  } else if (pathname.startsWith('/runs/')) {
    items.push({ label: 'Run' });
  }
  return items;
}

export default function App() {
  const breadcrumbItems = useRouteBreadcrumbs();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Article Analyzer
            </Link>
            {breadcrumbItems && (
              <Breadcrumb items={breadcrumbItems} />
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<ArticleListPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/runs/:id" element={<RunProgressPage />} />
        </Routes>
      </main>
    </div>
  );
}

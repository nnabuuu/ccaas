/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#f1f5f9',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#eef2ff',
          text: '#ffffff',
        },
        lesson: {
          DEFAULT: '#3b82f6',
          light: '#eff6ff',
        },
        problem: {
          DEFAULT: '#8b5cf6',
          light: '#f5f3ff',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.02em',
        wide: '0.04em',
      },
      borderRadius: {
        DEFAULT: '8px',
        panel: '12px',
        pill: '20px',
      },
      boxShadow: {
        micro: '0 1px 2px rgba(0,0,0,0.05)',
        float: '0 4px 12px rgba(0,0,0,0.08)',
      },
      transitionDuration: {
        button: '150ms',
        panel: '200ms',
        page: '300ms',
      },
    },
  },
  plugins: [],
}

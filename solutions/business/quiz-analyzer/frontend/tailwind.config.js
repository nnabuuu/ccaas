/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        // ck design system — mapped to CSS custom properties
        ck: {
          bg1: 'var(--bg1)',
          bg2: 'var(--bg2)',
          bg3: 'var(--bg3)',
          t1: 'var(--t1)',
          t2: 'var(--t2)',
          t3: 'var(--t3)',
          b1: 'var(--b1)',
          b2: 'var(--b2)',
          'info-bg': 'var(--info-bg)',
          'info-t': 'var(--info-t)',
          'success-bg': 'var(--success-bg)',
          'success-t': 'var(--success-t)',
          'warn-bg': 'var(--warn-bg)',
          'warn-t': 'var(--warn-t)',
          'danger-bg': 'var(--danger-bg)',
          'danger-t': 'var(--danger-t)',
          accent: 'var(--accent)',
          'accent-hover': 'var(--accent-hover)',
        },
        // Knowledge point source colors (business semantic — preserved)
        question: {
          light: '#dbeafe',
          DEFAULT: '#3b82f6',
          dark: '#1e40af',
        },
        solution: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#047857',
        },
        both: {
          light: '#e9d5ff',
          DEFAULT: '#a855f7',
          dark: '#7e22ce',
        },
      },
      fontFamily: {
        sans: ['system-ui', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'ck': 'var(--r)',
        'ck-lg': 'var(--rl)',
      },
      boxShadow: {
        'composer': 'var(--composer-shadow)',
        'composer-hover': 'var(--composer-shadow-hover)',
        'composer-focus': 'var(--composer-shadow-focus)',
      },
      transitionTimingFunction: {
        'claude': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'claude-spring': 'cubic-bezier(0.165, 0.85, 0.45, 1)',
      },
      keyframes: {
        'ck-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'ck-shimmer': 'ck-shimmer 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 200ms ease-in',
        'slide-up': 'slideUp 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
    },
  },
  plugins: [],
}

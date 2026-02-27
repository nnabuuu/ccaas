/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral dark backgrounds (Linear-inspired)
        surface: {
          0: '#0a0a0b',
          1: '#111113',
          2: '#1c1c1e',
          3: '#252528',
        },
        // Accent
        accent: '#818cf8',
        'accent-muted': '#6366f1',
        // Semantic text
        'text-primary': '#ececef',
        'text-secondary': '#8b8b8e',
        'text-tertiary': '#56565a',
        // Borders
        border: 'rgba(255,255,255,0.05)',
        'border-hover': 'rgba(255,255,255,0.10)',
        // Status
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        // Legacy aliases (keep for DynamicBoard/BlackboardPlayer)
        primary: '#818cf8',
        'background-dark': '#0a0a0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary: Analytics Blue
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Secondary from design system
          600: '#2563eb',
          700: '#1e40af', // Primary from design system
          800: '#1e3a8a', // Text color
          900: '#1e293b',
        },
        // Secondary: Teal for progress/success
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488', // Primary from e-learning palette
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a', // Text from e-learning palette
        },
        // CTA: Amber/Orange for actions
        cta: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // CTA from analytics palette
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Knowledge point source colors
        question: {
          light: '#dbeafe', // blue-100
          DEFAULT: '#3b82f6', // blue-500
          dark: '#1e40af', // blue-700
        },
        solution: {
          light: '#d1fae5', // green-100
          DEFAULT: '#10b981', // green-500
          dark: '#047857', // green-700
        },
        both: {
          light: '#e9d5ff', // purple-100
          DEFAULT: '#a855f7', // purple-500
          dark: '#7e22ce', // purple-700
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.06)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in',
        'slide-up': 'slideUp 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
      keyframes: {
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
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#13ec5b',
        'background-dark': '#102216',
        chalkboard: '#1A3A32',
        'logic-yellow': '#FFD700',
        'warning-red': '#FF4444',
      },
      fontFamily: {
        lexend: ['Lexend', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

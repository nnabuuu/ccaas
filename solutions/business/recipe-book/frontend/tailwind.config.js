/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../../../packages/chat-interface/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
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
          'user-bubble': 'var(--user-bubble-bg)',
          accent: 'var(--accent)',
          'accent-hover': 'var(--accent-hover)',
        },
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'serif'],
      },
      borderRadius: {
        ck: 'var(--r)',
        'ck-lg': 'var(--rl)',
      },
      boxShadow: {
        'composer': 'var(--composer-shadow)',
        'composer-hover': 'var(--composer-shadow-hover)',
        'composer-focus': 'var(--composer-shadow-focus)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

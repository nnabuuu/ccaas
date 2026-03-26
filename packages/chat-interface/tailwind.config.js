/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
      keyframes: {
        'ck-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'ck-blink': 'ck-blink 1s steps(1) infinite',
      },
      transitionTimingFunction: {
        'claude': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'claude-spring': 'cubic-bezier(0.165, 0.85, 0.45, 1)',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--t1)',
            '--tw-prose-headings': 'var(--t1)',
            '--tw-prose-links': 'var(--info-t)',
            '--tw-prose-bold': 'var(--t1)',
            '--tw-prose-code': 'var(--t1)',
            '--tw-prose-pre-code': 'var(--t1)',
            '--tw-prose-pre-bg': 'var(--bg3)',
            '--tw-prose-counters': 'var(--t2)',
            '--tw-prose-bullets': 'var(--t3)',
            '--tw-prose-quotes': 'var(--t2)',
            '--tw-prose-quote-borders': 'var(--b1)',
            '--tw-prose-hr': 'var(--b1)',
            '--tw-prose-th-borders': 'var(--b1)',
            '--tw-prose-td-borders': 'var(--b2)',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

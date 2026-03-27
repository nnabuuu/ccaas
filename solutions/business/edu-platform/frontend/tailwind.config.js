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
          'danger-t': 'var(--danger-t)',
        },
      },
      borderRadius: {
        ck: 'var(--r)',
        'ck-lg': 'var(--rl)',
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
            '--tw-prose-pre-bg': 'var(--bg2)',
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

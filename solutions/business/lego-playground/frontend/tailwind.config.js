/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lego: {
          red: '#C91A09',
          blue: '#0055BF',
          yellow: '#F2CD37',
          green: '#237841',
          orange: '#FE8A18',
          dark: '#1B2A34',
          light: '#F5F5F0',
        },
      },
    },
  },
  plugins: [],
};

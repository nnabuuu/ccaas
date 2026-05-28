/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'PingFang SC', 'sans-serif'],
      },
      colors: {
        /* Re-tint Tailwind's defaults to the live-lesson warm-neutral
         * palette. Component code is full of bg-gray-50, text-gray-700,
         * bg-emerald-100, bg-purple-50, etc. — overriding the scales
         * here keeps those classes working but renders them in the
         * design palette. Anchors map directly to design tokens; the
         * in-between steps interpolate to a warm chord, never pure
         * cool grays.
         *
         * Source of truth: design/surfaces/colors_and_type.css */

        /* Warm-neutral gray scale (anchors: 50→--surface,
         * 100→--surface2, 400→--t3, 600→--t2, 900→--t1) */
        gray: {
          50:  '#fbfaf7',
          100: '#edece7',
          200: '#e0ded7',
          300: '#c8c5bd',
          400: '#9c9a92',
          500: '#7c7a74',
          600: '#5c5b56',
          700: '#46453f',
          800: '#2e2d2a',
          900: '#1c1c1a',
          950: '#0f0f0e',
        },

        /* Greens — anchors: 50→--green-bg, 600→--green */
        emerald: {
          50:  '#e6f2dc',
          100: '#d4e6c1',
          200: '#b9d49b',
          300: '#9bbf74',
          400: '#78a751',
          500: '#52853a',
          600: '#2d6612',
          700: '#24520e',
          800: '#1c3f0b',
          900: '#152e08',
        },
        green: {
          50:  '#e6f2dc',
          100: '#d4e6c1',
          200: '#b9d49b',
          300: '#9bbf74',
          400: '#78a751',
          500: '#52853a',
          600: '#2d6612',
          700: '#24520e',
          800: '#1c3f0b',
          900: '#152e08',
        },

        /* Purples / violets — anchors: 50→--purple-bg, 700→--purple */
        purple: {
          50:  '#eceafe',
          100: '#dedbfc',
          200: '#c2bdf7',
          300: '#a299ef',
          400: '#7d72df',
          500: '#5c4fc4',
          600: '#473b9e',
          700: '#3a3185',
          800: '#2e276b',
          900: '#221d50',
        },
        violet: {
          50:  '#eceafe',
          100: '#dedbfc',
          200: '#c2bdf7',
          300: '#a299ef',
          400: '#7d72df',
          500: '#5c4fc4',
          600: '#473b9e',
          700: '#3a3185',
          800: '#2e276b',
          900: '#221d50',
        },

        /* Blues — anchors: 50→--blue-bg, 700→--blue */
        blue: {
          50:  '#e4eff8',
          100: '#cce0f0',
          200: '#a3c5e2',
          300: '#76a8d1',
          400: '#4a8bc1',
          500: '#2872b0',
          600: '#1d68a7',
          700: '#1a5fa0',
          800: '#154d82',
          900: '#103a62',
        },

        /* Ambers / yellows / oranges — anchors: 50→--amber-bg, 700→--amber */
        amber: {
          50:  '#f6edda',
          100: '#eddcb3',
          200: '#dec585',
          300: '#cdab58',
          400: '#b89033',
          500: '#a07820',
          600: '#8a6515',
          700: '#7a4d0e',
          800: '#5f3c0a',
          900: '#472d08',
        },
        yellow: {
          50:  '#f6edda',
          100: '#eddcb3',
          200: '#dec585',
          300: '#cdab58',
          400: '#b89033',
          500: '#a07820',
          600: '#8a6515',
          700: '#7a4d0e',
          800: '#5f3c0a',
          900: '#472d08',
        },
        orange: {
          50:  '#f7ebe5',
          100: '#eed6c8',
          200: '#dab198',
          300: '#c08c6a',
          400: '#a26b46',
          500: '#85502e',
          600: '#76401f',
          700: '#6b2a14',
          800: '#52200f',
          900: '#3a170a',
        },

        /* Reds */
        red: {
          50:  '#f8e6e6',
          100: '#f0cccc',
          200: '#e2a3a3',
          300: '#d27676',
          400: '#bf4f4f',
          500: '#a83333',
          600: '#9d2c2c',
          700: '#942929',
          800: '#761f1f',
          900: '#581717',
        },
        rose: {
          50:  '#f7ebe5',
          100: '#eed6c8',
          200: '#dab198',
          300: '#c08c6a',
          400: '#a26b46',
          500: '#85502e',
          600: '#76401f',
          700: '#6b2a14',
          800: '#52200f',
          900: '#3a170a',
        },

        /* Teals — anchors: 50→--teal-bg, 700→--teal */
        teal: {
          50:  '#ddf1eb',
          100: '#bce3d6',
          200: '#8ecdb9',
          300: '#5fb59a',
          400: '#3a9a7e',
          500: '#1f7d65',
          600: '#136355',
          700: '#0d5245',
          800: '#0a4138',
          900: '#073029',
        },
        cyan: {
          50:  '#ddf1eb',
          100: '#bce3d6',
          200: '#8ecdb9',
          300: '#5fb59a',
          400: '#3a9a7e',
          500: '#1f7d65',
          600: '#136355',
          700: '#0d5245',
          800: '#0a4138',
          900: '#073029',
        },

        /* Bring `white` and `black` in toward the warm anchors so
         * `bg-white` cards visibly float on the `--bg` page color and
         * `bg-black` reads as deep ink rather than pure black. */
        white: '#fbfaf7',
        black: '#1c1c1a',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

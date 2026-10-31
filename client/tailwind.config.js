/** @type {import('tailwindcss').Config} */
// Brand, slate and radius tokens are CSS variables (see src/index.css) so the
// authenticated dashboard (.theme-app) can use a different look than public pages.
const channel = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (prefix, steps) => Object.fromEntries(steps.map((step) => [step, channel(`${prefix}-${step}`)]));

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        slate: scale('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        accent: {
          50: '#fff3ed',
          100: '#ffe2d3',
          200: '#ffc3a5',
          300: '#ff9d6e',
          400: '#ff824d',
          500: '#ff6a2e',
          600: '#f0521a',
          700: '#c63f12',
          800: '#9b3312',
          900: '#7c2d12',
        },
        shell: '#d9d3cb',
        canvas: '#ece9e3',
      },
      borderRadius: {
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        btn: 'var(--r-btn)',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        soft: 'var(--shadow-soft)'
      }
    },
  },
  plugins: [],
};

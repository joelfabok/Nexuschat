/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nexus brand colors - deep navy/slate palette
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: {
          900: '#0d0f17',  // deepest background
          800: '#12141f',  // sidebar
          700: '#181b2a',  // channel list
          600: '#1e2235',  // chat area bg
          500: '#252840',  // input/card bg
          400: '#2e3350',  // hover state
          300: '#3d4266',  // borders
        },
        text: {
          primary: '#e8eaf6',
          secondary: '#9fa8b8',
          muted: '#5c6479',
        },
        status: {
          online: '#43b581',
          idle: '#faa61a',
          dnd: '#f04747',
          offline: '#747f8d',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      },
    },
  },
  plugins: [],
};

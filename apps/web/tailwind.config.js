/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4D64E6',
          hover: '#3F54D1',
          accent: '#2F5BE0',
        },
        navy: {
          DEFAULT: '#172031',
          2: '#1E2A44',
          3: '#111625',
        },
        tint: {
          DEFAULT: '#F3F5FF',
          2: '#F6F7FB',
        },
        'text-muted': '#5B6475',
        success: {
          DEFAULT: '#1F8A4C',
          bg: '#EAFBF0',
        },
        whatsapp: '#25D366',
        lavender: '#A9B6FF',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        '2xs': '0 1px 2px rgba(16, 24, 40, 0.04)',
        'xs': '0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#6c5ce7',
        secondary: '#a29bfe',
        background: '#000000',
        card: '#111111',
        border: '#333333',
        error: '#ff4444',
        success: '#00cc88'
      },
      borderRadius: {
        DEFAULT: '12px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.25)',
        input: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  plugins: [],
} 
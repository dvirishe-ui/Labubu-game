/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0c0b0d', 900: '#141217', 800: '#1d1a21', 700: '#29252f', 600: '#3a3542', 400: '#8b8494', 200: '#d9d3de' },
        amber: { 300: '#ffd27a', 400: '#ffbe3b', 500: '#f5a300', 600: '#c98200' },
        cherry: { 300: '#ff8a9a', 400: '#ff4d64', 500: '#e0243f', 600: '#b5122c' }
      },
      fontFamily: {
        display: ['"Secular One"', '"Rubik"', 'system-ui', 'sans-serif'],
        body: ['"Rubik"', 'system-ui', 'sans-serif']
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.85)', opacity: '0' }, '60%': { transform: 'scale(1.04)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(14px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        flicker: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.75' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-6px)' }, '75%': { transform: 'translateX(6px)' } }
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both',
        rise: 'rise .35s ease-out both',
        flicker: 'flicker 2.4s ease-in-out infinite',
        shake: 'shake .35s ease-in-out'
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}','./lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        g: { gold: '#D4A843', 50: '#FBF5E6', 100: '#F3E2B5' },
        d: { bg: '#06080F', panel: '#0C1017', card: '#111827', surface: '#171F2E', border: '#1F2937', hover: '#1C2536', text: '#94A3B8', light: '#CBD5E1', white: '#F1F5F9' },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

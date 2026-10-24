/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brizfit: '#10b981', // Emerald green
        parkrun: '#f59e0b', // Warm amber
        cycle: '#06b6d4',   // Cyan
        run: '#f43f5e',     // Coral / Rose
        walk: '#14b8a6',    // Mint
        trt: '#8b5cf6'      // Purple
      }
    },
  },
  plugins: [],
};

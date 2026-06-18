/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#E10600',
          dark: '#0a0a0a',
          panel: '#15151a',
          border: '#2a2a32',
          muted: '#6b7280',
          accent: '#00d4aa',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.7' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

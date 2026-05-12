/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#07090c',
          elevated: '#0d1116',
          card: '#12171e',
          'card-hover': '#171d26',
        },
        border: {
          DEFAULT: '#1e2530',
          strong: '#2a3340',
        },
        text: {
          primary: '#e9eef5',
          secondary: '#94a0b4',
          muted: '#5e6878',
        },
        brand: {
          DEFAULT: '#00ff88',
          dim: '#00cc6e',
          glow: 'rgba(0, 255, 136, 0.35)',
        },
        accent: {
          red: '#ff3b5c',
          purple: '#a259ff',
          black: '#1a1f28',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(0, 255, 136, 0.35)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};

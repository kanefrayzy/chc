import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: '#f1f5f9',
        surface: '#ffffff',
        elevated: '#f8fafc',
        overlay: 'rgba(15, 23, 42, 0.55)',
        sidebar: {
          DEFAULT: '#0f172a',
          elev: '#1e293b',
          hover: 'rgba(255,255,255,0.07)',
          active: 'rgba(99,102,241,0.18)',
          text: '#e2e8f0',
          muted: '#94a3b8',
          border: 'rgba(255,255,255,0.06)',
        },
        border: {
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
        },
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          100: '#f1f5f9',
          50:  '#f8fafc',
        },
        primary: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          tint: '#eef2ff',
          glow: 'rgba(99,102,241,0.20)',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          tint: '#fef9c3',
        },
        success: { DEFAULT: '#10b981', tint: '#d1fae5', dark: '#059669' },
        warning: { DEFAULT: '#f59e0b', tint: '#fef9c3', dark: '#d97706' },
        danger:  { DEFAULT: '#ef4444', tint: '#fee2e2', dark: '#dc2626' },
        info:    { DEFAULT: '#3b82f6', tint: '#dbeafe', dark: '#2563eb' },
      },
      fontFamily: {
        sans: ['"Inter"', '"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm:  '6px',
        md:  '8px',
        lg:  '12px',
        xl:  '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        md:    '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
        lg:    '0 8px 24px rgba(15,23,42,0.10), 0 4px 8px rgba(15,23,42,0.06)',
        focus: '0 0 0 3px rgba(99,102,241,0.30)',
        glow:  '0 0 20px rgba(99,102,241,0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        'typing': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'pop-in':   'pop-in 0.15s ease-out',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        'typing': 'typing 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

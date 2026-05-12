import type { Config } from 'tailwindcss';

/**
 * Admin tailwind config. Намеренно НЕ наследует web-preset, чтобы визуально
 * отделить административную панель от основного сайта:
 *  - светлая «офисная» тема (vs тёмный gambling-сайт);
 *  - violet primary + amber accent (vs neon-green);
 *  - типографика — IBM Plex Sans (vs Inter);
 *  - угловатые radii и плоские поверхности без glow.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: '#f4f5fa',
        surface: '#ffffff',
        elevated: '#fafbff',
        sidebar: '#1f1f2e',
        'sidebar-elev': '#2a2a3d',
        'sidebar-hover': '#33334b',
        'sidebar-text': '#d5d7e3',
        'sidebar-muted': '#8a8db1',
        border: {
          DEFAULT: '#e1e4ee',
          strong: '#c7cbd9',
        },
        ink: {
          900: '#15192a',
          700: '#2e3346',
          500: '#5b6378',
          400: '#7a8194',
          300: '#a0a6b8',
        },
        primary: {
          DEFAULT: '#6d28d9',
          light: '#7c3aed',
          dark: '#5b21b6',
          tint: '#ede9fe',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          tint: '#fef3c7',
        },
        success: { DEFAULT: '#0e9f6e', tint: '#d1fae5' },
        warning: { DEFAULT: '#d97706', tint: '#fef3c7' },
        danger: { DEFAULT: '#dc2626', tint: '#fee2e2' },
        info: { DEFAULT: '#2563eb', tint: '#dbeafe' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        focus: '0 0 0 3px rgba(109, 40, 217, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;

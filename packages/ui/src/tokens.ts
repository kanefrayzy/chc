/**
 * Design tokens — единая палитра CHCGREEN (тёмная, неоновый зелёный).
 * Используется в Tailwind preset и в CSS-переменных.
 */

export const colors = {
  // background
  bgBase: '#07090c',
  bgElevated: '#0d1116',
  bgCard: '#12171e',
  bgCardHover: '#171d26',
  // borders
  border: '#1e2530',
  borderStrong: '#2a3340',
  // text
  textPrimary: '#e9eef5',
  textSecondary: '#94a0b4',
  textMuted: '#5e6878',
  // brand
  brand: '#00ff88',
  brandDim: '#00cc6e',
  brandGlow: 'rgba(0, 255, 136, 0.35)',
  // accents
  accentRed: '#ff3b5c',
  accentPurple: '#a259ff',
  accentBlack: '#1a1f28',
  // status
  success: '#00ff88',
  warning: '#ffb547',
  danger: '#ff3b5c',
} as const;

export const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  display: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
} as const;

export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '9999px',
} as const;

export const shadows = {
  glow: '0 0 24px rgba(0, 255, 136, 0.35)',
  card: '0 4px 24px rgba(0, 0, 0, 0.4)',
} as const;

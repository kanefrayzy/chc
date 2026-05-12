import type { Config } from 'tailwindcss';
import preset from '@chcgreen/ui/tailwind-preset';

const config: Config = {
  presets: [preset as Config],
  content: ['./src/**/*.{ts,tsx,mdx}'],
};

export default config;

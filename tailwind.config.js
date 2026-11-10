/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: { DEFAULT: '#05070D', 2: '#0B1020', 3: '#111831' },
        cyan: { neon: '#00E5FF' },
        bull: '#00FF9C',
        bear: '#FF2E63',
        warn: '#FFB800',
        ink: { DEFAULT: 'rgba(255,255,255,0.9)', dim: '#8A94A6' },
      },
      fontFamily: {
        display: ['Orbitron', 'Space Grotesk', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0,229,255,.5), 0 0 18px rgba(0,229,255,.35)',
        'glow-bull': '0 0 0 1px rgba(0,255,156,.5), 0 0 18px rgba(0,255,156,.3)',
        'glow-bear': '0 0 0 1px rgba(255,46,99,.55), 0 0 18px rgba(255,46,99,.3)',
      },
    },
  },
  plugins: [],
};

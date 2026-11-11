/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies: la profundidad se da con tono, no con sombras.
        void: { DEFAULT: '#0E0F13', 2: '#17181E', 3: '#1F2128' },
        line: '#2A2D37',
        accent: { DEFAULT: '#8B7CFF', soft: '#B3A9FF', deep: '#5B4FD6' },
        bull: '#3DDC97',
        bear: '#FF6B7D',
        warn: '#F5B84A',
        ink: { DEFAULT: '#EDEEF2', dim: '#9097A6' },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
        grotesk: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        ctl: '14px',
      },
      boxShadow: {
        // Anillos en lugar de brillos.
        glow: '0 0 0 1.5px #8B7CFF',
        'glow-bull': '0 0 0 1.5px #3DDC97',
        'glow-bear': '0 0 0 1.5px #FF6B7D',
        lift: '0 12px 32px -12px rgba(0,0,0,.6)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        nova: {
          black: '#000000',
          dark: '#1C1C1E',
          spark: '#1A1625',
        },
        // Light cards (Pillowtalk cream)
        cream: {
          DEFAULT: '#F2F2F0',
          dark: '#E8E6E1',
        },
        // Chat background (Grok beige)
        beige: {
          DEFAULT: '#F5F3EE',
          dark: '#E8E6E1',
        },
        // Accent purple
        accent: {
          DEFAULT: '#C4B5FD',
          dim: 'rgba(196,181,253,0.7)',
          purple: '#A78BFA',
          dark: '#5B4B82',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'system-ui',
          'sans-serif',
        ],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      animation: {
        'bounce-dots': 'bounce-dots 1.4s infinite ease-in-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        'bounce-dots': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

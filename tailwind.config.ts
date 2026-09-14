import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0d0f',
          900: '#111418',
          850: '#15191f',
          800: '#1a1f26',
          750: '#1f252d',
          700: '#252c36',
          line: '#2a313c'
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706'
        },
        warn: { 400: '#fbbf24', 500: '#f59e0b' },
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      borderRadius: {
        xl2: '1rem'
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.25)',
        pop: '0 8px 30px rgba(0,0,0,.5)',
        glow: '0 0 0 3px rgba(16,185,129,.25)'
      }
    }
  },
  plugins: []
} satisfies Config
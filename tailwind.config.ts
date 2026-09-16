import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        sm: '640px'
      },
      spacing: {
        'safe-top': 'var(--sait)',
        'safe-bottom': 'var(--saib)',
        'safe-left': 'var(--sail)',
        'safe-right': 'var(--sair)',
      },
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
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        primary: { DEFAULT: '#10b981', hover: '#059669', active: '#047857' },
        surface: '#15191f',
        background: '#0a0d0f'
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
      },
      keyframes: {
        'bottom-sheet': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        'page-fade': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'tab-active': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' }
        },
        'pop': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      animation: {
        'bottom-sheet': 'bottom-sheet 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'page-fade': 'page-fade 0.2s ease-out forwards',
        'tab-active': 'tab-active 0.2s ease-out forwards',
        'pop': 'pop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
      }
    }
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.tabular-nums': {
          fontVariantNumeric: 'tabular-nums',
        },
        '.safe-pt': {
          paddingTop: 'var(--sait)',
        },
        '.safe-pb': {
          paddingBottom: 'var(--saib)',
        }
      })
    })
  ]
} satisfies Config
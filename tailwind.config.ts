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
          950: '#f8fafc',
          900: '#ffffff',
          850: '#ffffff',
          800: '#f1f5f9',
          750: '#e2e8f0',
          700: '#cbd5e1',
          line: '#e2e8f0'
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b'
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706'
        },
        warn: { 400: '#fbbf24', 500: '#f59e0b' },
        danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
        primary: { DEFAULT: '#059669', hover: '#047857', active: '#065f46' },
        surface: '#ffffff',
        background: '#f8fafc'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      borderRadius: {
        xl2: '1rem'
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.07)',
        pop: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        glow: '0 0 0 3px rgba(16,185,129,.25)'
      },
      keyframes: {
        'bottom-sheet': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        'page-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'tab-active': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' }
        },
        'pop': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'neon-pulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.45)) drop-shadow(0 0 25px rgba(16, 185, 129, 0.25))' },
          '50%': { filter: 'drop-shadow(0 0 24px rgba(52, 211, 153, 0.85)) drop-shadow(0 0 45px rgba(16, 185, 129, 0.5))' }
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        'logo-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'laser-sweep': {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.85' },
          '50%': { transform: 'translateY(220px)', opacity: '1' }
        }
      },
      animation: {
        'bottom-sheet': 'bottom-sheet 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'page-fade': 'page-fade 0.2s ease-out forwards',
        'tab-active': 'tab-active 0.2s ease-out forwards',
        'pop': 'pop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'neon-pulse': 'neon-pulse 2.5s ease-in-out infinite',
        'float-slow': 'float-slow 3s ease-in-out infinite',
        'logo-pop': 'logo-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'laser-sweep': 'laser-sweep 1.8s ease-in-out infinite'
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
/**
 * Every colour here resolves to a CSS custom property declared in src/styles/index.css.
 * That indirection is the design system: one token list, two themes, no colour literal
 * in a component.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page)',
        surface: 'var(--surface)',
        sunken: 'var(--surface-sunken)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        line: 'var(--border)',
        structural: 'var(--border-strong)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-wash': 'var(--accent-wash)',
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      transitionTimingFunction: {
        house: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      borderRadius: {
        card: '14px',
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pin-drop': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.94)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pin-drop': 'pin-drop 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

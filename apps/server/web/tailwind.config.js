/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme colors using CSS variables (defined in app.css)
        'theme-bg': 'var(--color-bg)',
        'theme-bg-elevated': 'var(--color-bg-elevated)',
        'theme-bg-canvas': 'var(--color-bg-canvas)',
        'theme-border': 'var(--color-border)',
        'theme-text': 'var(--color-text)',
        'theme-text-muted': 'var(--color-text-muted)',
        'theme-text-emphasis': 'var(--color-text-emphasis)',
        // Shumoku brand colors
        primary: {
          DEFAULT: '#7FE4C1',
          dark: '#5fd3a8',
          light: '#a5edd4',
        },
        success: '#73BF69',
        warning: '#FADE2A',
        danger: '#FF5E5E',
        info: '#6E9FFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Grafana-inspired dark theme colors
        dark: {
          bg: '#111217',
          'bg-elevated': '#181b1f',
          'bg-canvas': '#0b0c0e',
          border: '#2c2f36',
          text: '#ccccdc',
          'text-muted': '#8e8e9a',
          'text-emphasis': '#ffffff',
        },
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

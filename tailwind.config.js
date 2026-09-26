/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          deep: 'var(--bg-deep)',
          main: 'var(--bg-main)',
          panel: 'var(--bg-panel)',
        },
        surf: {
          DEFAULT: 'var(--surface)',
          hover: 'var(--surface-hover)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          dim: 'var(--text-secondary)',
          mute: 'var(--text-muted)',
        },
        plant: {
          dark: 'var(--plant-dark)',
          DEFAULT: 'var(--plant)',
          mid: 'var(--plant-mid)',
          light: 'var(--plant-light)',
        },
        soul: {
          DEFAULT: 'var(--soul-lime)',
          hi: 'var(--soul-gold)',
          lo: 'var(--sun-deep)',
        },
        petal: {
          light: 'var(--glow-soft)',
          DEFAULT: 'var(--petal-solid)',
          deep: 'var(--petal-solid-deep)',
        },
        sun: {
          DEFAULT: 'var(--sun-warm)',
          deep: 'var(--sun-deep)',
          glow: 'var(--glow-soft)',
        },
        leaf: {
          DEFAULT: 'var(--plant)',
          dark: 'var(--plant-dark)',
          warn: 'var(--leaf-warning)',
          warnDark: 'var(--leaf-warning-dark)',
        },
        orb: {
          DEFAULT: 'var(--paper-orb)',
          light: 'var(--paper-orb-light)',
        },
        danger: 'var(--conflict)',
        root: {
          DEFAULT: 'var(--root-main)',
          light: 'var(--root-light)',
        },
        soil: 'var(--soil)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  }
}

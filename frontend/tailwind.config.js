/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 5vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.035em', fontWeight: '700' }],
        h1: ['clamp(1.75rem, 4vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '700' }],
        h2: ['clamp(1.5rem, 3vw, 1.875rem)', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '700' }],
        h3: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-xl)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow-sm)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)',
      },
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },
        brand: {
          primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover-rgb) / <alpha-value>)',
          active: 'rgb(var(--brand-active-rgb) / <alpha-value>)',
          light: 'rgb(var(--brand-light-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary-rgb) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          background: 'rgb(var(--surface-background-rgb) / <alpha-value>)',
          alt: 'rgb(var(--surface-alt-rgb) / <alpha-value>)',
          accent: 'rgb(var(--surface-accent-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          inverse: 'rgb(var(--text-inverse-rgb) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-rgb) / <alpha-value>)',
          strong: 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
          background: 'rgb(var(--success-background-rgb) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)',
          background: 'rgb(var(--warning-background-rgb) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--error-rgb) / <alpha-value>)',
          background: 'rgb(var(--error-background-rgb) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)',
          background: 'rgb(var(--info-background-rgb) / <alpha-value>)',
        },
        focus: 'rgb(var(--focus-rgb) / <alpha-value>)',
        overlay: 'rgb(var(--overlay-rgb) / 0.45)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        chart: {
          1: 'rgb(var(--chart-1) / <alpha-value>)',
          2: 'rgb(var(--chart-2) / <alpha-value>)',
          3: 'rgb(var(--chart-3) / <alpha-value>)',
          4: 'rgb(var(--chart-4) / <alpha-value>)',
          5: 'rgb(var(--chart-5) / <alpha-value>)',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

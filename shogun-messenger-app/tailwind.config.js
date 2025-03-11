let defaultTheme = require('tailwindcss/defaultTheme');
let colors = require('tailwindcss/colors');

module.exports = {
  darkMode: 'class',
  mode: 'jit',
  purge: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette ispirata a Signal
        signal: {
          blue: '#2C6BED',       // Blu primario di Signal
          'blue-light': '#3A76F0',  
          'blue-dark': '#1A5BD7',
          gray: colors.neutral,
          background: {
            light: '#FFFFFF',    // Sfondo chiaro
            dark: '#121212',     // Sfondo scuro
          },
          surface: {
            light: '#F6F6F6',    // Superfici chiare, come card o sidebar
            dark: '#1E1E1E',     // Superfici scure
          },
          sidebar: {
            light: '#EEEEEE',    // Sidebar chiara
            dark: '#2C2C2C',     // Sidebar scura
          },
          border: {
            light: '#E5E5E5',    // Bordi chiari
            dark: '#3A3A3A',     // Bordi scuri
          },
          text: {
            light: '#111111',    // Testo principale chiaro
            dark: '#FFFFFF',     // Testo principale scuro
            muted: {
              light: '#767676',  // Testo secondario chiaro
              dark: '#AAAAAA',   // Testo secondario scuro
            },
          }
        },
        // Mantieni i colori tradizionali per compatibilità
        gray: colors.neutral,
      },
      fontWeight: ['hover', 'focus'],
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT:
          '0 1px 4px 0 rgba(0, 0, 0, 0.09), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
      },
      transitionProperty: {
        width: 'width',
        height: 'height',
        padding: 'padding',
        wp: 'width, padding',
        border: 'border-color',
        radius: 'border-radius'
      },
      keyframes: {
        'fade-in-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-out-down': {
          from: {
            opacity: '1',
            transform: 'translateY(0px)',
          },
          to: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'fade-out-up': {
          from: {
            opacity: '1',
            transform: 'translateY(0px)',
          },
          to: {
            opacity: '0',
            transform: 'translateY(-20px)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.5s ease-out',
        'fade-out-down': 'fade-out-down 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-out-up': 'fade-out-up 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-in-out',
      },
    },
  },
  variants: {},
  plugins: [],
};

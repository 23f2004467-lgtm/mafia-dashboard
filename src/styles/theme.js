/**
 * Design System Theme
 * Professional color palette and design tokens for MAFIA Dashboard
 */

export const theme = {
  colors: {
    // Primary brand colors
    primary: {
      50: '#f5e6f5',
      100: '#ebb8eb',
      200: '#e08ae0',
      300: '#d65cd5',
      400: '#cc2ecc',
      500: '#c300c3',
      600: '#9c009c',
      700: '#750075',
      800: '#4d004d',
      900: '#260026',
    },
    // Semantic colors
    success: {
      light: '#4caf50',
      main: '#388e3c',
      dark: '#2e7d32',
    },
    error: {
      light: '#ef5350',
      main: '#f44336',
      dark: '#d32f2f',
    },
    warning: {
      light: '#ffa726',
      main: '#ff9800',
      dark: '#f57c00',
    },
    info: {
      light: '#42a5f5',
      main: '#2196f3',
      dark: '#1976d2',
    },
    // Neutral colors
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    // Background colors
    background: {
      default: '#0a0a1a',
      paper: 'rgba(26, 26, 26, 0.95)',
      elevated: 'rgba(40, 40, 60, 0.98)',
    },
    // Text colors
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
      disabled: '#666666',
      hint: '#757575',
    },
  },
  // Spacing scale (8px base unit)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  // Border radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  // Shadows
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    md: '0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.2)',
  },
  // Typography
  typography: {
    fontFamily: {
      default: "'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
      mono: "'Fira Code', 'Source Code Pro', monospace",
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    modal: 1040,
    popover: 1060,
    tooltip: 1080,
  },
};

export const gradients = {
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  success: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  danger: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  dark: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
};

export default theme;

import React from 'react';
import { theme } from '../../styles/theme';

/**
 * Professional Button Component
 * Supports multiple variants, sizes, and states
 */
const Button = ({
  children,
  variant = 'primary', // primary, secondary, success, danger, warning, ghost
  size = 'md', // sm, md, lg
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  icon,
  iconPosition = 'left',
  ...props
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: `all ${theme.transitions.base}`,
    fontFamily: theme.typography.fontFamily.default,
    whiteSpace: 'nowrap',
  };

  const sizeStyles = {
    sm: {
      padding: '0.5rem 1rem',
      fontSize: theme.typography.fontSize.sm,
      minHeight: '36px',
    },
    md: {
      padding: '0.75rem 1.5rem',
      fontSize: theme.typography.fontSize.base,
      minHeight: '44px',
    },
    lg: {
      padding: '1rem 2rem',
      fontSize: theme.typography.fontSize.lg,
      minHeight: '52px',
    },
  };

  const variantStyles = {
    primary: {
      background: theme.colors.primary[500],
      color: '#ffffff',
      boxShadow: `0 4px 14px rgba(195, 0, 195, 0.4)`,
      '&:hover': {
        background: theme.colors.primary[600],
        transform: 'translateY(-2px)',
        boxShadow: `0 6px 20px rgba(195, 0, 195, 0.5)`,
      },
    },
    secondary: {
      background: theme.colors.gray[700],
      color: '#ffffff',
      boxShadow: theme.shadows.sm,
      '&:hover': {
        background: theme.colors.gray[600],
        transform: 'translateY(-1px)',
      },
    },
    success: {
      background: theme.colors.success.main,
      color: '#ffffff',
      boxShadow: `0 4px 14px rgba(76, 175, 80, 0.4)`,
      '&:hover': {
        background: theme.colors.success.dark,
        transform: 'translateY(-2px)',
      },
    },
    danger: {
      background: theme.colors.error.main,
      color: '#ffffff',
      boxShadow: `0 4px 14px rgba(244, 67, 54, 0.4)`,
      '&:hover': {
        background: theme.colors.error.dark,
        transform: 'translateY(-2px)',
      },
    },
    warning: {
      background: theme.colors.warning.main,
      color: '#ffffff',
      boxShadow: `0 4px 14px rgba(255, 152, 0, 0.4)`,
      '&:hover': {
        background: theme.colors.warning.dark,
        transform: 'translateY(-2px)',
      },
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.primary[500],
      border: `1px solid ${theme.colors.primary[500]}`,
      '&:hover': {
        background: `${theme.colors.primary[500]}10`,
      },
    },
  };

  const disabledStyles = {
    opacity: '0.6',
    cursor: 'not-allowed',
    transform: 'none !important',
  };

  const combinedStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(disabled || loading ? disabledStyles : {}),
    ...(fullWidth ? { width: '100%' } : {}),
  };

  // Convert style object to CSS string
  const styleString = Object.entries(combinedStyles)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${typeof value === 'object' ? '' : value}`;
    })
    .join('; ');

  return (
    <button
      type={type}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
      style={combinedStyles}
      {...props}
    >
      {loading && (
        <svg
          className="btn-spinner"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            strokeOpacity="0.3"
          />
          <path
            d="M12 2C17.5228 2 22 6.47715 22 12"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
};

export default Button;

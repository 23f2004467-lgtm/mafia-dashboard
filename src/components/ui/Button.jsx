import React from 'react';

/**
 * Button Component - MAFIA Design System
 *
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg
 */
export const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}, ref) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-base)',
    opacity: disabled ? 0.5 : 1,
  };

  const sizeStyles = {
    sm: { padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: '0.75rem' },
    md: { padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: '0.875rem' },
    lg: { padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '1rem' },
  };

  const variantStyles = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'white',
      boxShadow: 'var(--shadow-glow-sm)',
    },
    secondary: {
      backgroundColor: 'var(--color-surface-input)',
      color: 'white',
      border: '2px solid var(--color-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-primary)',
    },
    danger: {
      backgroundColor: 'var(--color-error)',
      color: 'white',
    },
    success: {
      backgroundColor: 'var(--color-success)',
      color: 'white',
    },
  };

  const style = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    props.onClick?.(e);
  };

  return (
    <button
      ref={ref}
      className={`btn btn-${variant} btn-${size} ${className}`}
      style={style}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && <span className="spinner">⏳</span>}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

// Convenience exports
export const PrimaryButton = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton = (props) => <Button variant="secondary" {...props} />;
export const GhostButton = (props) => <Button variant="ghost" {...props} />;
export const DangerButton = (props) => <Button variant="danger" {...props} />;
export const SuccessButton = (props) => <Button variant="success" {...props} />;

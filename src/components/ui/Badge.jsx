import React from 'react';

/**
 * Badge Component - MAFIA Design System
 *
 * Small status indicators and labels.
 */
export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  style = {},
  ...props
}) => {
  const variantStyles = {
    default: {
      backgroundColor: 'var(--color-surface-elevated)',
      color: 'var(--color-text-primary)',
    },
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'white',
    },
    success: {
      backgroundColor: 'var(--color-success)',
      color: 'white',
    },
    error: {
      backgroundColor: 'var(--color-error)',
      color: 'white',
    },
    warning: {
      backgroundColor: 'var(--color-warning)',
      color: 'black',
    },
    info: {
      backgroundColor: 'var(--color-info)',
      color: 'white',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-surface-border)',
    },
  };

  const sizeStyles = {
    sm: { padding: '2px 6px', fontSize: '0.625rem' },
    md: { padding: '4px 8px', fontSize: '0.75rem' },
    lg: { padding: '6px 12px', fontSize: '0.875rem' },
  };

  return (
    <span
      className={`badge badge-${variant} badge-${size} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: 'var(--radius-full)',
        fontWeight: 600,
        transition: 'all var(--transition-fast)',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
};

/**
 * Status Badge - Pre-configured status indicators
 */
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    paid: { variant: 'success', icon: '✓', label: 'Paid' },
    pending: { variant: 'warning', icon: '⏳', label: 'Pending' },
    verified: { variant: 'success', icon: '✓', label: 'Verified' },
    rejected: { variant: 'error', icon: '✕', label: 'Rejected' },
    processing: { variant: 'info', icon: '⟳', label: 'Processing' },
    interview: { variant: 'primary', icon: '💬', label: 'Interview' },
    selected: { variant: 'success', icon: '★', label: 'Selected' },
    waitlist: { variant: 'warning', icon: '⏸', label: 'Waitlist' },
  };

  const config = statusConfig[status?.toLowerCase()] || { variant: 'default', icon: '•', label: status };

  return <Badge variant={config.variant} icon={config.icon}>{config.label}</Badge>;
};

/**
 * Alert Component - MAFIA Design System
 *
 * Dismissible alerts for feedback and notifications.
 */
export const Alert = ({
  children,
  variant = 'info',
  title,
  dismissible = false,
  onDismiss,
  className = '',
  style = {},
  ...props
}) => {
  const variantStyles = {
    info: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderLeftColor: 'var(--color-info)',
      color: '#60a5fa',
    },
    success: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderLeftColor: 'var(--color-success)',
      color: 'var(--color-success-light)',
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderLeftColor: 'var(--color-warning)',
      color: '#fbbf24',
    },
    error: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderLeftColor: 'var(--color-error)',
      color: '#f87171',
    },
  };

  const icons = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '✕',
  };

  return (
    <div
      className={`alert alert-${variant} ${className}`}
      style={{
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--radius-md)',
        borderLeft: `4px solid ${variantStyles[variant].borderLeftColor}`,
        backgroundColor: variantStyles[variant].backgroundColor,
        display: 'flex',
        gap: 'var(--spacing-sm)',
        alignItems: 'flex-start',
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{icons[variant]}</span>
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: '0.875rem' }}>{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: 0,
            opacity: 0.7,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
};

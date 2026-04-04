import React from 'react';

/**
 * Card Component - MAFIA Design System
 *
 * A container component with elevation and border.
 */
export const Card = React.forwardRef(({
  children,
  title,
  subtitle,
  footer,
  hover = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const baseStyles = {
    backgroundColor: 'var(--color-surface-card)',
    border: '1px solid var(--color-surface-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-lg)',
    boxShadow: 'var(--shadow-md)',
    transition: hover ? 'all var(--transition-base)' : 'none',
    cursor: hover ? 'pointer' : 'default',
  };

  const hoverStyles = hover ? {
    '&:hover': {
      boxShadow: 'var(--shadow-lg)',
      transform: 'translateY(-2px)',
    }
  } : {};

  return (
    <div
      ref={ref}
      className={`card ${className}`}
      style={{ ...baseStyles, ...style }}
      onMouseEnter={hover ? (e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      } : undefined}
      onMouseLeave={hover ? (e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(0)';
      } : undefined}
      {...props}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          {title && (
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '0 0 var(--spacing-xs) 0',
            }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
      {footer && (
        <div style={{
          marginTop: 'var(--spacing-lg)',
          paddingTop: 'var(--spacing-md)',
          borderTop: '1px solid var(--color-surface-border)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
});

Card.displayName = 'Card';

// Convenience components
export const CandidateCard = ({ name, regNo, status, onClick, ...props }) => (
  <Card hover onClick={onClick} {...props}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h4 style={{ color: 'var(--color-primary)', margin: '0 0 var(--spacing-xs) 0' }}>
          {name}
        </h4>
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', margin: 0 }}>
          {regNo}
        </p>
      </div>
      <Badge variant={status === 'paid' ? 'success' : status === 'pending' ? 'warning' : 'default'}>
        {status}
      </Badge>
    </div>
  </Card>
);

export const StatCard = ({ label, value, icon, trend, ...props }) => (
  <Card {...props}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
      {icon && (
        <span style={{ fontSize: '2rem', opacity: 0.8 }}>
          {icon}
        </span>
      )}
      <div>
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', margin: 0 }}>
          {label}
        </p>
        <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {value}
        </p>
        {trend && (
          <p style={{ fontSize: '0.75rem', color: trend > 0 ? 'var(--color-success)' : 'var(--color-error)', margin: 'var(--spacing-xs) 0 0 0' }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </p>
        )}
      </div>
    </div>
  </Card>
);

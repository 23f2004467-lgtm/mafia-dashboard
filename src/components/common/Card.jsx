import React from 'react';
import { theme, gradients } from '../../styles/theme';

/**
 * Professional Card Component
 * Glassmorphism design with multiple variants
 */
const Card = ({
  children,
  variant = 'default', // default, gradient, glass, elevated
  gradient = 'primary',
  padding = 'lg',
  hoverable = false,
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles = {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[padding],
    backdropFilter: 'blur(10px)',
    transition: `all ${theme.transitions.base}`,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const paddingStyles = {
    sm: { padding: theme.spacing.md },
    md: { padding: theme.spacing.lg },
    lg: { padding: '1.5rem' },
    xl: { padding: theme.spacing.xl },
  };

  const variantStyles = {
    default: {
      background: theme.colors.background.paper,
      boxShadow: theme.shadows.md,
    },
    gradient: {
      background: gradients[gradient] || gradients.primary,
      color: '#ffffff',
      boxShadow: theme.shadows.lg,
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.05)',
      boxShadow: theme.shadows.md,
    },
    elevated: {
      background: theme.colors.background.elevated,
      boxShadow: theme.shadows.lg,
    },
  };

  const hoverStyles = hoverable
    ? {
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows.xl,
        },
      }
    : {};

  const combinedStyles = {
    ...baseStyles,
    ...paddingStyles[padding],
    ...variantStyles[variant],
    ...hoverStyles,
  };

  return (
    <div
      className={`card card-${variant} ${hoverable ? 'card-hoverable' : ''} ${className}`}
      style={combinedStyles}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Card Header Component
 */
export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`card-header ${className}`} style={{ marginBottom: theme.spacing.md }} {...props}>
    {children}
  </div>
);

/**
 * Card Title Component
 */
export const CardTitle = ({ children, className = '', ...props }) => (
  <h3
    className={`card-title ${className}`}
    style={{
      margin: 0,
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text.primary,
    }}
    {...props}
  >
    {children}
  </h3>
);

/**
 * Card Subtitle Component
 */
export const CardSubtitle = ({ children, className = '', ...props }) => (
  <p
    className={`card-subtitle ${className}`}
    style={{
      margin: `${theme.spacing.xs} 0 0 0`,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.secondary,
    }}
    {...props}
  >
    {children}
  </p>
);

/**
 * Card Content Component
 */
export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`card-content ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Footer Component
 */
export const CardFooter = ({ children, className = '', ...props }) => (
  <div
    className={`card-footer ${className}`}
    style={{
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    }}
    {...props}
  >
    {children}
  </div>
);

/**
 * Stat Card Component (for metrics display)
 */
export const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  gradient = 'primary',
  className = '',
}) => (
  <Card variant="gradient" gradient={gradient} className={`stat-card ${className}`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: theme.typography.fontSize.sm, opacity: 0.9, marginBottom: theme.spacing.xs }}>
          {title}
        </div>
        <div style={{ fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: theme.typography.fontSize.xs, opacity: 0.8, marginTop: theme.spacing.xs }}>
            {subtitle}
          </div>
        )}
        {trend && (
          <div
            style={{
              fontSize: theme.typography.fontSize.xs,
              marginTop: theme.spacing.xs,
              color: trend.positive ? '#4ade80' : '#f87171',
            }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
      {icon && (
        <div
          style={{
            fontSize: '2rem',
            opacity: 0.8,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.md,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  </Card>
);

export default Card;

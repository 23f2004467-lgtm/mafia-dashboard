import React from 'react';
import { theme } from '../../styles/theme';

/**
 * Badge Component
 * For status indicators, labels, and counts
 */
const Badge = ({
  children,
  variant = 'default', // default, primary, success, error, warning, info
  size = 'md', // sm, md, lg
  rounded = false,
  dot = false,
  className = '',
  ...props
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: theme.typography.fontWeight.medium,
    transition: `all ${theme.transitions.fast}`,
  };

  const sizeStyles = {
    sm: {
      padding: '0.25rem 0.5rem',
      fontSize: theme.typography.fontSize.xs,
      gap: '4px',
    },
    md: {
      padding: '0.35rem 0.65rem',
      fontSize: theme.typography.fontSize.sm,
      gap: '6px',
    },
    lg: {
      padding: '0.5rem 0.75rem',
      fontSize: theme.typography.fontSize.base,
      gap: '8px',
    },
  };

  const variantStyles = {
    default: {
      backgroundColor: theme.colors.gray[700],
      color: theme.colors.text.primary,
    },
    primary: {
      backgroundColor: `${theme.colors.primary[500]}20`,
      color: theme.colors.primary[300],
      border: `1px solid ${theme.colors.primary[500]}40`,
    },
    success: {
      backgroundColor: `${theme.colors.success.main}20`,
      color: theme.colors.success.light,
      border: `1px solid ${theme.colors.success.main}40`,
    },
    error: {
      backgroundColor: `${theme.colors.error.main}20`,
      color: theme.colors.error.light,
      border: `1px solid ${theme.colors.error.main}40`,
    },
    warning: {
      backgroundColor: `${theme.colors.warning.main}20`,
      color: theme.colors.warning.light,
      border: `1px solid ${theme.colors.warning.main}40`,
    },
    info: {
      backgroundColor: `${theme.colors.info.main}20`,
      color: theme.colors.info.light,
      border: `1px solid ${theme.colors.info.main}40`,
    },
  };

  const dotStyles = {
    width: size === 'sm' ? '6px' : size === 'md' ? '8px' : '10px',
    height: size === 'sm' ? '6px' : size === 'md' ? '8px' : '10px',
    borderRadius: '50%',
  };

  const combinedStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    borderRadius: rounded ? '9999px' : theme.borderRadius.md,
  };

  return (
    <span
      className={`badge badge-${variant} badge-${size} ${rounded ? 'badge-rounded' : ''} ${className}`}
      style={combinedStyles}
      {...props}
    >
      {dot && <span style={{ ...dotStyles, backgroundColor: 'currentColor' }} />}
      {children}
    </span>
  );
};

/**
 * Status Badge Component
 * Pre-configured badges for common statuses
 */
export const StatusBadge = ({ status, size = 'md', className = '', ...props }) => {
  const statusConfig = {
    paid: {
      variant: 'success',
      icon: '✓',
      label: 'Paid',
    },
    unpaid: {
      variant: 'error',
      icon: '✕',
      label: 'Unpaid',
    },
    pending: {
      variant: 'warning',
      icon: '○',
      label: 'Pending',
    },
    verified: {
      variant: 'success',
      icon: '✓',
      label: 'Verified',
    },
    selected: {
      variant: 'success',
      icon: '✓',
      label: 'Selected',
    },
    rejected: {
      variant: 'error',
      icon: '✕',
      label: 'Rejected',
    },
    waitlisted: {
      variant: 'warning',
      icon: '○',
      label: 'Waitlisted',
    },
    active: {
      variant: 'success',
      icon: '●',
      label: 'Active',
    },
    inactive: {
      variant: 'default',
      icon: '○',
      label: 'Inactive',
    },
  };

  const config = statusConfig[status?.toLowerCase()] || {
    variant: 'default',
    icon: '•',
    label: status,
  };

  return (
    <Badge variant={config.variant} size={size} className={className} {...props}>
      {config.icon} {config.label}
    </Badge>
  );
};

/**
 * Year Badge Component
 * For displaying academic year badges
 */
export const YearBadge = ({ year, className = '', ...props }) => {
  const yearColors = {
    '1st year': {
      background: theme.colors.success.main,
      color: '#ffffff',
    },
    '2nd year': {
      background: theme.colors.info.main,
      color: '#ffffff',
    },
    '3rd year': {
      background: theme.colors.warning.main,
      color: '#ffffff',
    },
    '4th year': {
      background: theme.colors.primary[500],
      color: '#ffffff',
    },
  };

  const styles = yearColors[year] || yearColors['1st year'];

  return (
    <Badge
      className={className}
      style={{
        backgroundColor: styles.background,
        color: styles.color,
        border: 'none',
      }}
      {...props}
    >
      {year}
    </Badge>
  );
};

export default Badge;

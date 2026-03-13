import React from 'react';
import { theme } from '../../styles/theme';

/**
 * Professional Input Component
 * Supports text, password, email, number, and search types
 */
const Input = ({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  helperText,
  icon,
  size = 'md',
  fullWidth = false,
  className = '',
  required = false,
  ...props
}) => {
  const baseStyles = {
    fontFamily: theme.typography.fontFamily.default,
    transition: `all ${theme.transitions.fast}`,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    color: theme.colors.text.primary,
  };

  const sizeStyles = {
    sm: {
      padding: '0.5rem 0.75rem',
      fontSize: theme.typography.fontSize.sm,
      minHeight: '36px',
    },
    md: {
      padding: '0.75rem 1rem',
      fontSize: theme.typography.fontSize.base,
      minHeight: '44px',
    },
    lg: {
      padding: '1rem 1.25rem',
      fontSize: theme.typography.fontSize.lg,
      minHeight: '52px',
    },
  };

  const focusStyles = {
    outline: 'none',
    borderColor: theme.colors.primary[500],
    boxShadow: `0 0 0 3px rgba(195, 0, 195, 0.2)`,
  };

  const errorStyles = error
    ? {
        borderColor: theme.colors.error.main,
        '&:focus': {
          borderColor: theme.colors.error.main,
          boxShadow: `0 0 0 3px rgba(244, 67, 54, 0.2)`,
        },
      }
    : {};

  const disabledStyles = disabled
    ? {
        opacity: 0.5,
        cursor: 'not-allowed',
        backgroundColor: theme.colors.gray[800],
      }
    : {};

  const inputStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...errorStyles,
    ...disabledStyles,
    ...(fullWidth ? { width: '100%' } : {}),
  };

  return (
    <div className={`input-wrapper ${className}`} style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label
          className="input-label"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            color: error ? theme.colors.error.main : theme.colors.text.secondary,
          }}
        >
          {label}
          {required && <span style={{ color: theme.colors.error.main, marginLeft: '2px' }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              left: theme.spacing.md,
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.text.secondary,
              pointerEvents: 'none',
            }}
          >
            {icon}
          </div>
        )}

        <input
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`input input-${size} ${error ? 'input-error' : ''} ${disabled ? 'input-disabled' : ''}`}
          style={{
            ...inputStyles,
            ...(icon ? { paddingLeft: '2.5rem' } : {}),
          }}
          {...props}
        />
      </div>

      {(error || helperText) && (
        <div
          className="input-helper-text"
          style={{
            marginTop: theme.spacing.xs,
            fontSize: theme.typography.fontSize.xs,
            color: error ? theme.colors.error.main : theme.colors.text.hint,
          }}
        >
          {error || helperText}
        </div>
      )}
    </div>
  );
};

/**
 * Select Component
 */
export const Select = ({
  label,
  options = [],
  value,
  onChange,
  disabled = false,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className = '',
  required = false,
  placeholder = 'Select an option',
  ...props
}) => {
  const baseStyles = {
    fontFamily: theme.typography.fontFamily.default,
    transition: `all ${theme.transitions.fast}`,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    color: theme.colors.text.primary,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `right ${theme.spacing.md} center`,
    paddingRight: '2.5rem',
  };

  const sizeStyles = {
    sm: {
      padding: '0.5rem 0.75rem',
      fontSize: theme.typography.fontSize.sm,
      minHeight: '36px',
    },
    md: {
      padding: '0.75rem 1rem',
      fontSize: theme.typography.fontSize.base,
      minHeight: '44px',
    },
    lg: {
      padding: '1rem 1.25rem',
      fontSize: theme.typography.fontSize.lg,
      minHeight: '52px',
    },
  };

  const selectStyles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...(error ? { borderColor: theme.colors.error.main } : {}),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
    ...(fullWidth ? { width: '100%' } : {}),
  };

  return (
    <div className={`select-wrapper ${className}`} style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label
          className="select-label"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            color: error ? theme.colors.error.main : theme.colors.text.secondary,
          }}
        >
          {label}
          {required && <span style={{ color: theme.colors.error.main, marginLeft: '2px' }}>*</span>}
        </label>
      )}

      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`select select-${size} ${error ? 'select-error' : ''} ${disabled ? 'select-disabled' : ''}`}
        style={selectStyles}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {(error || helperText) && (
        <div
          className="select-helper-text"
          style={{
            marginTop: theme.spacing.xs,
            fontSize: theme.typography.fontSize.xs,
            color: error ? theme.colors.error.main : theme.colors.text.hint,
          }}
        >
          {error || helperText}
        </div>
      )}
    </div>
  );
};

/**
 * Textarea Component
 */
export const Textarea = ({
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  helperText,
  rows = 4,
  fullWidth = false,
  className = '',
  required = false,
  ...props
}) => {
  const baseStyles = {
    fontFamily: theme.typography.fontFamily.default,
    transition: `all ${theme.transitions.fast}`,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    color: theme.colors.text.primary,
    padding: '0.75rem 1rem',
    fontSize: theme.typography.fontSize.base,
    resize: 'vertical',
    minHeight: '100px',
  };

  const textareaStyles = {
    ...baseStyles,
    ...(error ? { borderColor: theme.colors.error.main } : {}),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
    ...(fullWidth ? { width: '100%' } : {}),
  };

  return (
    <div className={`textarea-wrapper ${className}`} style={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <label
          className="textarea-label"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            color: error ? theme.colors.error.main : theme.colors.text.secondary,
          }}
        >
          {label}
          {required && <span style={{ color: theme.colors.error.main, marginLeft: '2px' }}>*</span>}
        </label>
      )}

      <textarea
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={`textarea ${error ? 'textarea-error' : ''} ${disabled ? 'textarea-disabled' : ''}`}
        style={textareaStyles}
        {...props}
      />

      {(error || helperText) && (
        <div
          className="textarea-helper-text"
          style={{
            marginTop: theme.spacing.xs,
            fontSize: theme.typography.fontSize.xs,
            color: error ? theme.colors.error.main : theme.colors.text.hint,
          }}
        >
          {error || helperText}
        </div>
      )}
    </div>
  );
};

export default Input;

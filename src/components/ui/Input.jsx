import React from 'react';

/**
 * Input Component - MAFIA Design System
 *
 * Form inputs with consistent styling and focus states.
 */
export const Input = React.forwardRef(({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  className = '',
  style = {},
  ...props
}, ref) => {
  const inputStyles = {
    width: '100%',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-surface-input)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-surface-border)'}`,
    borderRadius: 'var(--radius-md)',
    transition: 'all var(--transition-fast)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const labelStyles = {
    display: 'block',
    marginBottom: 'var(--spacing-xs)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: error ? 'var(--color-error)' : 'var(--color-text-secondary)',
  };

  const helperStyles = {
    fontSize: '0.75rem',
    marginTop: 'var(--spacing-xs)',
    color: error ? 'var(--color-error)' : 'var(--color-text-tertiary)',
  };

  return (
    <div className={`input-wrapper ${className}`} style={style}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: 'var(--color-error)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        className="input"
        style={inputStyles}
        disabled={disabled}
        {...props}
      />
      {(error || helper) && (
        <p style={helperStyles}>
          {error || helper}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Select component
export const Select = React.forwardRef(({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  options = [],
  className = '',
  style = {},
  ...props
}, ref) => {
  const selectStyles = {
    width: '100%',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-surface-input)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-surface-border)'}`,
    borderRadius: 'var(--radius-md)',
    transition: 'all var(--transition-fast)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <div className={`select-wrapper ${className}`} style={style}>
      {label && (
        <label style={{ marginBottom: 'var(--spacing-xs)', display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
          {label}
          {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <select
        ref={ref}
        className="input"
        style={selectStyles}
        disabled={disabled}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-xs)', color: 'var(--color-error)' }}>{error}</p>}
      {helper && !error && <p style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-xs)', color: 'var(--color-text-tertiary)' }}>{helper}</p>}
    </div>
  );
});

Select.displayName = 'Select';

// Textarea component
export const Textarea = React.forwardRef(({
  label,
  error,
  helper,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  style = {},
  ...props
}, ref) => {
  const textareaStyles = {
    width: '100%',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-surface-input)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-surface-border)'}`,
    borderRadius: 'var(--radius-md)',
    transition: 'all var(--transition-fast)',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    resize: 'vertical',
    minHeight: rows * 24,
  };

  return (
    <div className={`textarea-wrapper ${className}`} style={style}>
      {label && (
        <label style={{ marginBottom: 'var(--spacing-xs)', display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
          {label}
          {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className="input"
        style={textareaStyles}
        disabled={disabled}
        rows={rows}
        {...props}
      />
      {(error || helper) && (
        <p style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-xs)', color: error ? 'var(--color-error)' : 'var(--color-text-tertiary)' }}>
          {error || helper}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

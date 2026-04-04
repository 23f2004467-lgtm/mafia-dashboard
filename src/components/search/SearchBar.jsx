import React from 'react';
import { Input } from '../ui/Input';

/**
 * SearchBar Component - MAFIA Recruitment Dashboard
 *
 * Candidate search with debouncing.
 */
export const SearchBar = ({ value, onChange, onSearch, placeholder = "Search candidates by name or registration number...", disabled = false }) => {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch?.(localValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localValue, onSearch]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange?.('');
    onSearch?.('');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Input
        type="text"
        value={value !== undefined ? value : localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          paddingLeft: '3rem',
          paddingRight: localValue ? '3rem' : '1rem',
        }}
      />
      <span style={{
        position: 'absolute',
        left: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--color-text-tertiary)',
        pointerEvents: 'none',
      }}>
        🔍
      </span>
      {localValue && (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.25rem',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-surface-border)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ×
        </button>
      )}
    </div>
  );
};

/**
 * SearchResults Component
 *
 * Display search results with click handlers.
 */
export const SearchResults = ({ results, onSelectCandidate, onClose }) => {
  if (!results || results.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: '0.5rem',
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-surface-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      maxHeight: '300px',
      overflowY: 'auto',
      zIndex: 100,
    }}>
      {results.map((candidate) => (
        <div
          key={candidate.regNo}
          onClick={() => onSelectCandidate(candidate)}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            cursor: 'pointer',
            borderBottom: '1px solid var(--color-surface-border)',
            transition: 'background-color var(--transition-fast)',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-surface-elevated)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                {candidate.name}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
                {candidate.regNo}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {candidate.paid && (
                <span style={{ fontSize: '0.875rem' }}>✓</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

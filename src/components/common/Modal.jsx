import React, { useEffect } from 'react';
import { theme } from '../../styles/theme';

/**
 * Professional Modal Component
 * Accessible dialog with backdrop and animations
 */
const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl, full
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  footer,
  className = '',
}) => {
  // Handle escape key press
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: {
      maxWidth: '400px',
      width: '90%',
    },
    md: {
      maxWidth: '600px',
      width: '90%',
    },
    lg: {
      maxWidth: '800px',
      width: '90%',
    },
    xl: {
      maxWidth: '1200px',
      width: '90%',
    },
    full: {
      maxWidth: '100%',
      width: '100%',
      height: '100vh',
      borderRadius: 0,
    },
  };

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.md,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className={`modal modal-${size} ${className}`}
        style={{
          ...sizeStyles[size],
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.borderRadius.xl,
          boxShadow: theme.shadows.xl,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className="modal-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: theme.spacing.lg,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {title && (
              <h2
                id="modal-title"
                className="modal-title"
                style={{
                  margin: 0,
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.text.primary,
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                className="modal-close"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.text.secondary,
                  cursor: 'pointer',
                  padding: theme.spacing.xs,
                  borderRadius: theme.borderRadius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: `all ${theme.transitions.fast}`,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: theme.colors.text.primary,
                  },
                }}
                aria-label="Close modal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className="modal-body"
          style={{
            padding: theme.spacing.lg,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="modal-footer"
            style={{
              display: 'flex',
              gap: theme.spacing.md,
              justifyContent: 'flex-end',
              padding: theme.spacing.lg,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-close:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: ${theme.colors.text.primary} !important;
        }
      `}</style>
    </div>
  );
};

/**
 * Confirm Dialog Component
 * Pre-configured modal for confirmations
 */
export const ConfirmDialog = ({
  isOpen = false,
  onClose = () => {},
  onConfirm = () => {},
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // danger, warning, info
  ...props
}) => {
  const variantStyles = {
    danger: {
      confirmColor: theme.colors.error.main,
      icon: '⚠️',
    },
    warning: {
      confirmColor: theme.colors.warning.main,
      icon: '⚠️',
    },
    info: {
      confirmColor: theme.colors.info.main,
      icon: 'ℹ️',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: theme.borderRadius.md,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'transparent',
              color: theme.colors.text.primary,
              cursor: 'pointer',
              fontWeight: theme.typography.fontWeight.medium,
              transition: `all ${theme.transitions.fast}`,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: theme.borderRadius.md,
              border: 'none',
              background: styles.confirmColor,
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: theme.typography.fontWeight.semibold,
              transition: `all ${theme.transitions.fast}`,
              boxShadow: `0 4px 14px ${styles.confirmColor}66`,
            }}
          >
            {confirmText}
          </button>
        </>
      }
      {...props}
    >
      <div style={{ textAlign: 'center', padding: theme.spacing.md }}>
        <div style={{ fontSize: '3rem', marginBottom: theme.spacing.md }}>{styles.icon}</div>
        <p
          style={{
            fontSize: theme.typography.fontSize.base,
            color: theme.colors.text.secondary,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
      </div>
    </Modal>
  );
};

export default Modal;

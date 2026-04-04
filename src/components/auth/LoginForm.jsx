import React from 'react';
import { PrimaryButton } from '../ui/Button';
import { Card } from '../ui/Card';

/**
 * LoginForm Component - MAFIA Recruitment Dashboard
 *
 * Google OAuth login form for interviewers.
 */
export const LoginForm = ({ onLogin, isLoggingIn }) => {
  const isMobile = window.innerWidth <= 768;

  const styles = {
    loginContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: isMobile ? '1rem' : '2rem',
    },
    loginCard: {
      backgroundColor: 'var(--color-surface-card)',
      border: '1px solid var(--color-surface-border)',
      borderRadius: 'var(--radius-xl)',
      padding: isMobile ? '2rem' : '3.5rem',
      maxWidth: isMobile ? '95vw' : '450px',
      width: '100%',
      boxShadow: 'var(--shadow-lg)',
      animation: 'fadeIn 0.5s ease-out',
    },
    loginHeader: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    logoContainer: {
      position: 'relative',
      display: 'inline-block',
      marginBottom: '1rem',
    },
    brandLogo: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    },
    logoImage: {
      width: '80px',
      height: '80px',
      objectFit: 'contain',
    },
    loginTitle: {
      fontFamily: 'var(--font-display)',
      fontSize: '3rem',
      fontWeight: 800,
      color: 'var(--color-primary)',
      margin: 0,
      textShadow: '0 0 30px rgba(204, 0, 204, 0.3)',
    },
    logoSubtitle: {
      fontSize: '0.875rem',
      color: 'var(--color-text-tertiary)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    logoGlow: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '120px',
      height: '120px',
      background: 'radial-gradient(circle, rgba(204, 0, 204, 0.2) 0%, transparent 70%)',
      filter: 'blur(20px)',
      zIndex: -1,
      animation: 'pulse-glow 2s ease-in-out infinite',
    },
    loginSubtitle: {
      fontSize: '1.125rem',
      color: 'var(--color-text-secondary)',
      margin: '0.5rem 0 0 0',
    },
    loginContent: {
      marginTop: '2rem',
    },
    loginDescription: {
      color: 'var(--color-text-secondary)',
      lineHeight: 1.6,
      marginBottom: '1.5rem',
    },
    loginButton: {
      width: '100%',
      padding: '1rem 1.5rem',
      fontSize: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
    },
    googleIcon: {
      fontSize: '1.25rem',
    },
    loginFeatures: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1rem',
      marginTop: '2rem',
    },
    feature: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: 'var(--radius-md)',
      transition: 'all var(--transition-base)',
    },
    featureIcon: {
      fontSize: '1.25rem',
    },
    contactInfo: {
      marginTop: '2rem',
      padding: '1rem',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-surface-border)',
    },
    contactHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.5rem',
    },
    contactIcon: {
      fontSize: '1.25rem',
    },
    contactTitle: {
      fontWeight: 600,
      color: 'var(--color-text-primary)',
    },
    contactText: {
      fontSize: '0.875rem',
      color: 'var(--color-text-secondary)',
      margin: 0,
    },
    contactNumber: {
      color: 'var(--color-primary)',
      fontWeight: 600,
    },
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <div style={styles.logoContainer}>
            <div style={styles.brandLogo}>
              <img
                src="/mafia-logo.png"
                alt="MAFIA Logo"
                style={styles.logoImage}
              />
              <h1 style={styles.loginTitle}>MAFIA</h1>
              <div style={styles.logoSubtitle}>TalentComm & WorkComm</div>
            </div>
            <div style={styles.logoGlow}></div>
          </div>
          <p style={styles.loginSubtitle}>Recruitment Interviewer Dashboard</p>
        </div>

        <div style={styles.loginContent}>
          <p style={styles.loginDescription}>
            Welcome to the MAFIA recruitment system. Access the interviewer dashboard
            to manage candidate applications, update verdicts, and verify payments.
          </p>

          <PrimaryButton
            onClick={onLogin}
            disabled={isLoggingIn}
            loading={isLoggingIn}
            size="lg"
            style={{ width: '100%' }}
          >
            <span style={styles.googleIcon}>
              {isLoggingIn ? '⏳' : '🔐'}
            </span>
            {isLoggingIn ? 'Signing In...' : 'Login with Gmail'}
          </PrimaryButton>

          <div style={styles.loginFeatures}>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>🔍</span>
              <span>Search & Filter</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>📝</span>
              <span>Update Verdicts</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>💳</span>
              <span>Payment Verify</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>📊</span>
              <span>Real-time Stats</span>
            </div>
          </div>

          <div style={styles.contactInfo}>
            <div style={styles.contactHeader}>
              <span style={styles.contactIcon}>📞</span>
              <span style={styles.contactTitle}>Need Help?</span>
            </div>
            <p style={styles.contactText}>
              If you have any issues or questions, contact us:
              <br />
              <span style={styles.contactNumber}>📱 9591185310</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { theme, gradients } from '../../styles/theme';
import { Button, Input, Card } from '../common';

/**
 * Admin Login Component
 * Professional login interface with branding
 */
const AdminLogin = ({ email, password, onEmailChange, onPasswordChange, onLogin, isLoading }) => {
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    background: gradients.dark,
  };

  const loginCardStyle = {
    maxWidth: '450px',
    width: '100%',
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.borderRadius.xl,
    padding: '2.5rem',
    boxShadow: theme.shadows.xl,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  };

  const logoStyle = {
    width: '70px',
    height: '70px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 15px rgba(204, 0, 204, 0.5))',
    marginBottom: theme.spacing.md,
  };

  const titleStyle = {
    color: theme.colors.primary[400],
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    margin: 0,
    textShadow: '0 0 20px rgba(204, 0, 204, 0.5)',
    letterSpacing: '2px',
  };

  const subtitleStyle = {
    color: theme.colors.primary[300],
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  };

  const descriptionStyle = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.base,
    margin: 0,
    fontWeight: theme.typography.fontWeight.light,
  };

  const featuresStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  };

  const featureStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.borderRadius.md,
    transition: `all ${theme.transitions.fast}`,
  };

  const features = [
    { icon: '📊', text: 'Real-time Analytics' },
    { icon: '👥', text: 'Candidate Management' },
    { icon: '📥', text: 'Data Export' },
    { icon: '🔧', text: 'System Controls' },
  ];

  return (
    <div style={containerStyle}>
      <div style={loginCardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <img src="/mafia-logo.png" alt="MAFIA Logo" style={logoStyle} />
          <h1 style={titleStyle}>MAFIA</h1>
          <div style={subtitleStyle}>Admin Portal</div>
          <p style={descriptionStyle}>Secure Administrative Access</p>
        </div>

        {/* Form */}
        <div>
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@mafia.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            fullWidth
            required
            style={{ marginBottom: theme.spacing.md }}
            onKeyPress={(e) => e.key === 'Enter' && onLogin()}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            fullWidth
            required
            style={{ marginBottom: theme.spacing.lg }}
            onKeyPress={(e) => e.key === 'Enter' && onLogin()}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onLogin}
            loading={isLoading}
            icon="🔓"
          >
            Access Admin Panel
          </Button>
        </div>

        {/* Features */}
        <div style={featuresStyle}>
          {features.map((feature, index) => (
            <div key={index} style={featureStyle}>
              <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span>
              <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
                {feature.text}
              </span>
            </div>
          ))}
        </div>

        {/* Contact Info */}
        <div
          style={{
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: theme.borderRadius.md,
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <span style={{ fontSize: '1.2rem' }}>📞</span>
            <span style={{ color: theme.colors.primary[400], fontWeight: theme.typography.fontWeight.semibold }}>
              Need Help?
            </span>
          </div>
          <p style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm, margin: 0 }}>
            Contact support at{' '}
            <span
              style={{
                color: theme.colors.primary[400],
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              📱 9591185310
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

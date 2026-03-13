import React from 'react';
import { Button, Card, Input, Badge, StatusBadge } from './components/common';

/**
 * Component Test Page
 * Visit http://localhost:3000/test to see all components
 */
function ComponentTest() {
  return (
    <div style={{
      padding: '2rem',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
    }}>
      <h1 style={{ color: '#cc00cc', marginBottom: '2rem' }}>Component Test Page</h1>

      {/* Buttons */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Buttons</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <Card variant="gradient" gradient="primary" padding="lg">
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Candidates</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>500+</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Registered Students</div>
          </Card>

          <Card variant="gradient" gradient="success" padding="lg">
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Paid</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>350</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Payment Confirmed</div>
          </Card>

          <Card variant="glass" padding="lg">
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Unpaid</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>150</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Pending Payment</div>
          </Card>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Inputs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
          />
        </div>
      </div>

      {/* Badges */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Badges</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="warning">Warning</Badge>
          <StatusBadge status="paid" />
          <StatusBadge status="unpaid" />
          <StatusBadge status="pending" />
          <StatusBadge status="verified" />
          <StatusBadge status="selected" />
          <StatusBadge status="rejected" />
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <h3 style={{ color: '#fff' }}>✅ If you can see this page with styled components, the component library is working!</h3>
        <p style={{ color: '#999' }}>Now go to <a href="/admin" style={{ color: '#cc00cc' }}>http://localhost:3000/admin</a> to see the refactored Admin Portal</p>
      </div>
    </div>
  );
}

export default ComponentTest;

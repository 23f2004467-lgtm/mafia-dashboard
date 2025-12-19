import React, { useState, useEffect } from 'react';

// Add CSS for pulse animation
const pulseAnimation = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;

// Inject the CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseAnimation;
  document.head.appendChild(style);
}

const PerformanceDashboard = ({ performanceMonitor }) => {
  const [metrics, setMetrics] = useState({});
  const [isVisible, setIsVisible] = useState(false);
  
  // Debug logging
  useEffect(() => {
    console.log('PerformanceDashboard mounted, performanceMonitor:', performanceMonitor);
  }, [performanceMonitor]);

  useEffect(() => {
    const updateMetrics = () => {
      if (performanceMonitor) {
        setMetrics(performanceMonitor.getMetrics());
      }
    };

    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [performanceMonitor]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#00ff88',
          color: '#000',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0, 255, 136, 0.5)',
          animation: 'pulse 2s infinite'
        }}
        title="Performance Dashboard - Click to open"
      >
        📊
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#1a1a1a',
      border: '2px solid #00ff88',
      borderRadius: '10px',
      padding: '15px',
      color: '#fff',
      fontSize: '12px',
      minWidth: '250px',
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0, 255, 136, 0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#00ff88' }}>Performance Metrics</h4>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Page Load:</strong> {metrics.pageLoadTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>API Response:</strong> {metrics.apiResponseTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Search Response:</strong> {metrics.searchResponseTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>QR Generation:</strong> {metrics.qrGenerationTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Admin Candidates:</strong> {metrics.adminCandidatesFetchTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Admin Interviewers:</strong> {metrics.adminInterviewersFetchTime || 0}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Memory Usage:</strong> {metrics.memoryUsage || 0}MB
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Active Connections:</strong> {metrics.activeConnections || 0}
      </div>
      
      <div style={{ 
        fontSize: '10px', 
        color: '#888', 
        marginTop: '10px',
        borderTop: '1px solid #333',
        paddingTop: '8px'
      }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceDashboard;
